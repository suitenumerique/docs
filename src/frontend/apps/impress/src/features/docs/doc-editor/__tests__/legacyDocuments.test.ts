/**
 * The documents written before the migration to Yjs 14 must open unchanged.
 *
 * Each document of `fixtures/legacyDocuments.ts` is written as the Yjs 13
 * editor did (y-prosemirror on a `yjs` 13 document), then opened by the Yjs 14
 * editor, collaboration included, as a migrated document is.
 *
 * The same documents seed the preview environments: regenerate their fixture
 * after a change to `fixtures/legacyDocuments.ts`, with `yarn legacy-documents`
 * from `apps/impress`.
 */
import fs from 'fs';
import path from 'path';

import { BlockNoteEditor } from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { YjsThreadStore, withCollaboration } from '@blocknote/core/y';
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from '@blocknote/core/yjs';
import * as Y from '@y/y';
import { fromBase64, toBase64 } from 'lib0/buffer';
import { afterEach, describe, expect, it } from 'vitest';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import * as Y13 from 'yjs';

import { InlineNodeCommentsExtension } from '@/docs/doc-comments/extensions/InlineNodeCommentsExtension';

import { blockNoteSchema } from '../components/BlockNoteEditor';

import {
  LEGACY_DOCUMENTS,
  LEGACY_OWNER,
  LegacyBlock,
  LegacyDocument,
  LegacyThread,
} from './fixtures/legacyDocuments';

const FRAGMENT = 'document-store';

const FIXTURE = path.resolve(
  __dirname,
  '../../../../../../../../backend/demo/data/legacy_documents.json',
);

const COMMENTABLE_NODES = ['interlinkingLinkInline', 'userMentionInline'];

type PMJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: PMJSON[];
};

const createExtensions = () => [
  CommentsExtension({
    threadStore: new YjsThreadStore(
      'user',
      new Y.Doc().get('threads'),
      new DefaultThreadStoreAuth('user', 'editor'),
    ),
    resolveUsers: async () => [],
  }),
  InlineNodeCommentsExtension(),
];

const editors: BlockNoteEditor<any, any, any>[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor._tiptapEditor.destroy());
});

const createLegacyEditor = () => {
  const editor = BlockNoteEditor.create({
    schema: blockNoteSchema,
    extensions: createExtensions(),
  });
  editors.push(editor);
  return editor;
};

type LegacyEditor = ReturnType<typeof createLegacyEditor>;

/** Fixed ids: the same blocks always give the same document. */
const withIds = (
  blocks: LegacyBlock[],
  prefix: string,
  counter = { value: 0 },
): LegacyBlock[] =>
  blocks.map((block) => ({
    ...block,
    id: block.id ?? `${prefix}-${(counter.value += 1)}`,
    ...(Array.isArray(block.children) && {
      children: withIds(block.children as LegacyBlock[], prefix, counter),
    }),
  }));

const commentMark = (threadId: string) => ({
  type: 'comment',
  attrs: { threadId, orphan: false },
});

/**
 * Comments are marks, which blocks cannot express. On a doc link or a mention,
 * the Yjs 13 editor kept them in the `commentMarks` attribute, y-prosemirror
 * not storing the marks of an element.
 */
const addComments = (node: PMJSON, threads: LegacyThread[]): PMJSON => {
  const thread = threads.find(
    ({ blockId }) =>
      node.type === 'blockContainer' && node.attrs?.id === blockId,
  );
  if (!thread) {
    return {
      ...node,
      ...(node.content && {
        content: node.content.map((child) => addComments(child, threads)),
      }),
    };
  }

  const [blockContent, ...rest] = node.content ?? [];
  const inline = (blockContent.content ?? []).map((child) => {
    const marks = [...(child.marks ?? []), commentMark(thread.id)];
    if (COMMENTABLE_NODES.includes(child.type)) {
      return {
        ...child,
        attrs: {
          ...child.attrs,
          commentMarks: JSON.stringify([
            { threadId: thread.id, orphan: false },
          ]),
        },
        marks,
      };
    }
    return child.type === 'text' ? { ...child, marks } : child;
  });

  return { ...node, content: [{ ...blockContent, content: inline }, ...rest] };
};

/**
 * Each revision is applied to the same Yjs 13 document, as the editor would
 * have: what changed is edited, so the later states carry deletions.
 */
const writeWithYjs13 = (editor: LegacyEditor, document: LegacyDocument) => {
  const ydoc = new Y13.Doc();
  const fragment = ydoc.getXmlFragment(FRAGMENT);
  const revisions = document.revisions.map((blocks) => {
    const node = _blocksToProsemirrorNode(
      editor,
      withIds(blocks, document.id.slice(-4)) as never,
    );
    const json = addComments(node.toJSON() as PMJSON, document.threads ?? []);
    prosemirrorToYXmlFragment(editor.pmSchema.nodeFromJSON(json), fragment);
    return Y13.encodeStateAsUpdate(ydoc);
  });

  return { revisions, blocks: yXmlFragmentToBlocks(editor, fragment) };
};

/** What the legacy editor shows of an update. */
const readWithYjs13 = (editor: LegacyEditor, update: Uint8Array) => {
  const ydoc = new Y13.Doc();
  Y13.applyUpdate(ydoc, update);
  return yXmlFragmentToBlocks(editor, ydoc.getXmlFragment(FRAGMENT));
};

const openWithYjs14 = (update: Uint8Array) => {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, update);
  const editor = BlockNoteEditor.create(
    withCollaboration({
      schema: blockNoteSchema,
      collaboration: {
        fragment: ydoc.get(FRAGMENT),
        user: { name: 'user', color: '#000000' },
        provider: undefined,
      },
      extensions: createExtensions(),
    }),
  );
  editor.mount(document.createElement('div'));
  editors.push(editor);
  return editor;
};

const commentedThreads = (editor: LegacyEditor) => {
  const threads = new Map<string, Set<string>>();
  editor.prosemirrorState.doc.descendants((node) => {
    node.marks
      .filter((mark) => mark.type.name === 'comment')
      .forEach((mark) => {
        const id = String(mark.attrs.threadId);
        threads.set(id, (threads.get(id) ?? new Set()).add(node.type.name));
      });
  });
  return threads;
};

describe('legacy documents', () => {
  it.each(LEGACY_DOCUMENTS.map((doc) => [doc.title, doc] as const))(
    'opens "%s", written with Yjs 13, unchanged with Yjs 14',
    (_title, legacyDocument) => {
      const legacyEditor = createLegacyEditor();
      const { revisions, blocks } = writeWithYjs13(
        legacyEditor,
        legacyDocument,
      );

      const editor = openWithYjs14(revisions.at(-1) as Uint8Array);

      expect(editor.document).toEqual(blocks);

      const threads = commentedThreads(editor);
      expect([...threads.keys()].sort()).toEqual(
        (legacyDocument.threads ?? []).map(({ id }) => id).sort(),
      );
      // the comments of the doc links and mentions came back from their attribute
      for (const [id, nodes] of threads) {
        const block = blocks.find(
          ({ id: blockId }) =>
            legacyDocument.threads?.find((thread) => thread.id === id)
              ?.blockId === blockId,
        );
        const inlineTypes = new Set(
          (block?.content as { type: string }[]).map(({ type }) => type),
        );
        COMMENTABLE_NODES.filter((type) => inlineTypes.has(type)).forEach(
          (type) => expect(nodes).toContain(type),
        );
      }
    },
  );

  it('covers every block, inline content and style of the editor', () => {
    const used = {
      blocks: new Set<string>(),
      inline: new Set<string>(),
      styles: new Set<string>(),
    };
    const visitInline = (content: unknown): void => {
      if (!Array.isArray(content)) {
        return;
      }
      content.forEach(
        (item: { type: string; styles?: object; content?: unknown }) => {
          used.inline.add(item.type);
          Object.keys(item.styles ?? {}).forEach((s) => used.styles.add(s));
          visitInline(item.content);
        },
      );
    };
    const visit = (blocks: LegacyEditor['document']): void =>
      blocks.forEach((block) => {
        used.blocks.add(block.type);
        if (Array.isArray(block.content)) {
          visitInline(block.content);
        } else if (block.content?.type === 'tableContent') {
          block.content.rows.forEach((row) =>
            row.cells.forEach((cell) =>
              visitInline('content' in cell ? cell.content : cell),
            ),
          );
        }
        visit(block.children);
      });

    const editor = createLegacyEditor();
    LEGACY_DOCUMENTS.forEach((legacyDocument) =>
      visit(writeWithYjs13(editor, legacyDocument).blocks),
    );

    expect([...used.blocks].sort()).toEqual(
      Object.keys(blockNoteSchema.blockSchema).sort(),
    );
    expect([...used.inline].sort()).toEqual(
      Object.keys(blockNoteSchema.inlineContentSchema).sort(),
    );
    expect([...used.styles].sort()).toEqual(
      Object.keys(blockNoteSchema.styleSchema).sort(),
    );
  });

  // The backend is not in the frontend container: checked where both are.
  it.skipIf(!fs.existsSync(FIXTURE) || process.env.WRITE_LEGACY_DOCUMENTS)(
    'matches the fixture the preview environments are seeded with',
    () => {
      const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as {
        documents: { id: string; revisions: string[] }[];
      };
      const editor = createLegacyEditor();

      expect(fixture.documents.map(({ id }) => id)).toEqual(
        LEGACY_DOCUMENTS.map(({ id }) => id),
      );
      fixture.documents.forEach(({ revisions }, index) => {
        const generated = writeWithYjs13(editor, LEGACY_DOCUMENTS[index]);
        expect(
          revisions.map((revision) =>
            readWithYjs13(editor, fromBase64(revision)),
          ),
          'Regenerate it with `yarn legacy-documents`',
        ).toEqual(
          generated.revisions.map((revision) =>
            readWithYjs13(editor, revision),
          ),
        );
      });
    },
  );

  it.runIf(process.env.WRITE_LEGACY_DOCUMENTS)(
    'writes the fixture the preview environments are seeded with',
    () => {
      const editor = createLegacyEditor();
      const documents = LEGACY_DOCUMENTS.map((legacyDocument) => ({
        id: legacyDocument.id,
        title: legacyDocument.title,
        parent_id: legacyDocument.parentId ?? null,
        revisions: writeWithYjs13(editor, legacyDocument).revisions.map(
          (revision) => toBase64(revision),
        ),
        attachments: legacyDocument.attachments ?? [],
        threads: (legacyDocument.threads ?? []).map(({ id, comment }) => ({
          id,
          comment,
        })),
      }));

      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(
        FIXTURE,
        `${JSON.stringify(
          {
            generated_by:
              'src/frontend/apps/impress/src/features/docs/doc-editor/__tests__/legacyDocuments.test.ts',
            owner: { id: LEGACY_OWNER.id, full_name: LEGACY_OWNER.fullName },
            documents,
          },
          null,
          2,
        )}\n`,
      );
    },
  );
});
