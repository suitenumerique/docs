import {
  DefaultBlockSchema,
  DefaultInlineContentSchema,
  DefaultStyleSchema,
  PartialBlock,
} from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger } from '@/utils';

interface ErrorResponse {
  error: string;
}

type ConversionResponseBody = Uint8Array | string | object | ErrorResponse;

interface InputReader {
  supportedContentTypes: string[];
  read(data: Buffer): Promise<PartialBlock[]>;
}

interface OutputWriter {
  supportedContentTypes: string[];
  write(blocks: PartialBlock[]): Promise<ConversionResponseBody>;
}

const editor = ServerBlockNoteEditor.create<
  DefaultBlockSchema,
  DefaultInlineContentSchema,
  DefaultStyleSchema
>();

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

const createYDocument = (blocks: PartialBlock[]) =>
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
      Y.applyUpdate(ydoc, data);
      return editor.yDocToBlocks(ydoc, 'document-store') as PartialBlock[];
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
    write: async (blocks) => Y.encodeStateAsUpdate(createYDocument(blocks)),
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

  let blocks:
    | PartialBlock<
        DefaultBlockSchema,
        DefaultInlineContentSchema,
        DefaultStyleSchema
      >[]
    | null;
  try {
    try {
      blocks = await reader.read(req.body);
    } catch (e) {
      logger('Invalid content:', e);
      res.status(400).json({ error: 'Invalid content' });
      return;
    }

    if (!blocks || blocks.length === 0) {
      res.status(500).json({ error: 'No valid blocks were generated' });
      return;
    }

    res
      .status(200)
      .setHeader('content-type', accept)
      .send(await writer.write(blocks));
  } catch (e) {
    logger('conversion failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  }
};
