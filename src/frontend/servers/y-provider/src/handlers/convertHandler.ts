import { PartialBlock } from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
  YjsThreadStore,
} from '@blocknote/core/comments';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
  docsBlockNoteSchema,
} from '@/blockSpecs';
import { logger } from '@/utils';

interface ErrorResponse {
  error: string;
}

type ConversionResponseBody = Uint8Array | string | object | ErrorResponse;

type DocsPartialBlock = PartialBlock<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>;

interface InputReader {
  supportedContentTypes: string[];
  read(data: Buffer): Promise<DocsPartialBlock[]>;
}

interface OutputWriter {
  supportedContentTypes: string[];
  write(blocks: DocsPartialBlock[]): Promise<ConversionResponseBody>;
}

/**
 * The "comment" mark must exist in the editor schema, otherwise y-prosemirror
 * silently discards every commented run of text when it reads the Yjs document
 * (a mark with no matching type in the schema is dropped together with the text
 * it wraps). This corrupts *all* conversion targets (HTML, Markdown, JSON...),
 * turning any block that holds a comment into an empty block.
 *
 * Registering the CommentsExtension is the only supported way to add that mark to
 * the schema. The thread store and user resolver below are never exercised during
 * conversion (we only read the document, we never resolve threads or users); they
 * exist solely to satisfy the extension's constructor.
 */
const commentsThreadStore = new YjsThreadStore(
  'y-provider',
  new Y.Doc().getMap('comment-threads'),
  new DefaultThreadStoreAuth('y-provider', 'editor'),
);

const editor = ServerBlockNoteEditor.create<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>({
  schema: docsBlockNoteSchema,
  extensions: [
    CommentsExtension({
      threadStore: commentsThreadStore,
      resolveUsers: (userIds) =>
        Promise.resolve(
          userIds.map((id) => ({ id, username: id, avatarUrl: '' })),
        ),
    }),
  ],
});

const ContentTypes = {
  XMarkdown: 'text/x-markdown',
  Markdown: 'text/markdown',
  YJS: 'application/vnd.yjs.doc',
  FormUrlEncoded: 'application/x-www-form-urlencoded',
  OctetStream: 'application/octet-stream',
  HTML: 'text/html',
  BlockNote: 'application/vnd.blocknote+json',
  JSON: 'application/json',
} as const;

const createYDocument = (blocks: DocsPartialBlock[]) =>
  editor.blocksToYDoc(blocks, 'document-store');

const readers: InputReader[] = [
  {
    // application/x-www-form-urlencoded is interpreted as Markdown for backward compatibility
    supportedContentTypes: [
      ContentTypes.Markdown,
      ContentTypes.XMarkdown,
      ContentTypes.FormUrlEncoded,
    ],
    read: (data) => editor.tryParseMarkdownToBlocks(data.toString()),
  },
  {
    supportedContentTypes: [ContentTypes.YJS, ContentTypes.OctetStream],
    read: async (data) => {
      const ydoc = new Y.Doc();
      try {
        Y.applyUpdate(ydoc, data);
        return editor.yDocToBlocks(ydoc, 'document-store');
      } finally {
        ydoc.destroy();
      }
    },
  },
  {
    supportedContentTypes: [ContentTypes.BlockNote],
    read: async (data) => JSON.parse(data.toString()),
  },
];

const writers: OutputWriter[] = [
  {
    supportedContentTypes: [ContentTypes.BlockNote, ContentTypes.JSON],
    write: async (blocks) => blocks,
  },
  {
    supportedContentTypes: [ContentTypes.YJS, ContentTypes.OctetStream],
    write: async (blocks) => {
      const ydoc = createYDocument(blocks);
      try {
        return Y.encodeStateAsUpdate(ydoc);
      } finally {
        ydoc.destroy();
      }
    },
  },
  {
    supportedContentTypes: [ContentTypes.Markdown, ContentTypes.XMarkdown],
    write: (blocks) => editor.blocksToMarkdownLossy(blocks),
  },
  {
    supportedContentTypes: [ContentTypes.HTML],
    write: (blocks) => editor.blocksToHTMLLossy(blocks),
  },
];

const normalizeContentType = (value: string) => value.split(';')[0];

export const convertHandler = async (
  req: Request<object, Uint8Array | ErrorResponse, Buffer, object>,
  res: Response<ConversionResponseBody>,
) => {
  if (!req.body || req.body.length === 0) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  const contentType = normalizeContentType(
    req.header('content-type') || ContentTypes.Markdown,
  );

  const reader = readers.find((reader) =>
    reader.supportedContentTypes.includes(contentType),
  );

  if (!reader) {
    res.status(415).json({ error: 'Unsupported Content-Type' });
    return;
  }

  const accept = normalizeContentType(req.header('accept') || ContentTypes.YJS);

  const writer = writers.find((writer) =>
    writer.supportedContentTypes.includes(accept),
  );

  if (!writer) {
    res.status(406).json({ error: 'Unsupported format' });
    return;
  }

  let blocks: DocsPartialBlock[] | null;
  try {
    try {
      blocks = await reader.read(req.body);
    } catch (e) {
      logger('Invalid content:', e);
      res.status(400).json({ error: 'Invalid content' });
      return;
    }

    res
      .status(200)
      .setHeader('content-type', accept)
      .send(await writer.write(blocks ?? []));
  } catch (e) {
    Sentry.captureException(e, {
      tags: { handler: 'convert' },
      extra: {
        contentType,
        accept,
        bodyBytes: req.body?.length ?? 0,
      },
    });
    logger('conversion failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  }
};
