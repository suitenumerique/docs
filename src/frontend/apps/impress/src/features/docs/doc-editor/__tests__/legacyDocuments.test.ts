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
  LEGACY_AUTHORS_ID,
  LEGACY_DOCUMENTS,
  LEGACY_HISTORY_ID,
  LEGACY_OWNER,
  LEGACY_USERS,
  LegacyBlock,
  LegacyDocument,
  LegacyEditActions,
  LegacyThread,
  LegacyUser,
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

const openWithYjs14 = (source: Uint8Array | Y.Doc) => {
  const ydoc = source instanceof Y.Doc ? source : new Y.Doc();
  if (!(source instanceof Y.Doc)) {
    Y.applyUpdate(ydoc, source);
  }
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

type Yjs14Editor = ReturnType<typeof openWithYjs14>;

/** What an edit of the fixture may do, on the real editor. */
const editActions = (editor: Yjs14Editor): LegacyEditActions => ({
  get document() {
    return editor.document;
  },
  replaceBlocks: (ids, blocks) => editor.replaceBlocks(ids, blocks),
  insertBlocks: (blocks, reference, placement) =>
    editor.insertBlocks(blocks, reference, placement),
  updateBlock: (id, update) => editor.updateBlock(id, update),
  removeBlocks: (ids) => editor.removeBlocks(ids),
  comment: (blockId, threadId) =>
    editor.transact((tr) => {
      let range: { from: number; to: number } | undefined;
      tr.doc.descendants((node, pos) => {
        if (range) {
          return false;
        }
        if (node.type.name === 'blockContainer' && node.attrs.id === blockId) {
          const from = pos + 2;
          range = { from, to: from + (node.firstChild?.content.size ?? 0) };
          return false;
        }
        return true;
      });
      if (!range) {
        throw new Error(`No block ${blockId} to comment`);
      }
      tr.addMark(
        range.from,
        range.to,
        editor.pmSchema.mark('comment', { threadId, orphan: false }),
      );
    }),
});

/**
 * The edits of the users, each made in an editor of their own on the document
 * as the previous ones left it. Only what their editor emitted is kept: a diff
 * against a state vector would carry every deletion ever made, which the
 * collaboration server would then attribute to them.
 */
const writeEdits = (
  legacyDocument: LegacyDocument,
  legacy: Uint8Array | undefined,
) => {
  const shared = new Y.Doc();
  if (legacy) {
    Y.applyUpdate(shared, legacy);
  }
  const edits = (legacyDocument.edits ?? []).map(
    ({ user, minutesAgo, apply }) => {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(shared));
      const updates: Uint8Array<ArrayBuffer>[] = [];
      ydoc.on('update', (update: Uint8Array<ArrayBuffer>) =>
        updates.push(update),
      );
      apply(editActions(openWithYjs14(ydoc)));
      const update = Y.mergeUpdates(updates);
      Y.applyUpdate(shared, update);
      return { user, minutesAgo, update };
    },
  );

  return { edits, result: Y.encodeStateAsUpdate(shared) };
};

/** The document as the users left it: the legacy state, then their edits. */
const applyEdits = (legacy: Uint8Array | undefined, updates: Uint8Array[]) => {
  const ydoc = new Y.Doc();
  if (legacy) {
    Y.applyUpdate(ydoc, legacy);
  }
  updates.forEach((update) => Y.applyUpdate(ydoc, update));
  return openWithYjs14(ydoc);
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
  it.each(
    LEGACY_DOCUMENTS.filter(({ revisions }) => revisions.length).map(
      (doc) => [doc.title, doc] as const,
    ),
  )(
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

  it.each(
    LEGACY_DOCUMENTS.filter(({ edits }) => edits?.length).map(
      (doc) => [doc.title, doc] as const,
    ),
  )('lets the users edit "%s" once migrated', (_title, legacyDocument) => {
    const { revisions } = writeWithYjs13(createLegacyEditor(), legacyDocument);
    const { edits } = writeEdits(legacyDocument, revisions.at(-1));

    // each edit changes something, and inserts only from its user's client:
    // a deletion is keyed by whoever inserted what it deletes
    edits.forEach(({ update }) => {
      const ids = Y.createContentIdsFromUpdate(update);
      expect(ids.inserts.clients.size).toBeLessThanOrEqual(1);
      expect(
        ids.inserts.clients.size + ids.deletes.clients.size,
      ).toBeGreaterThan(0);
    });
    const editor = applyEdits(
      revisions.at(-1),
      edits.map(({ update }) => update),
    );
    expect(editor.document.length).toBeGreaterThan(0);

    // dated in the past, the edits keep their order
    const ages = edits.map(({ minutesAgo }) => minutesAgo ?? 0);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  it('applies the edits of each user to "Written by several users"', () => {
    const legacyDocument = LEGACY_DOCUMENTS.find(
      ({ id }) => id === LEGACY_AUTHORS_ID,
    ) as LegacyDocument;
    const { revisions } = writeWithYjs13(createLegacyEditor(), legacyDocument);
    const { result } = writeEdits(legacyDocument, revisions.at(-1));

    const editor = openWithYjs14(result);
    const byId = new Map(editor.document.map((block) => [block.id, block]));
    const plain = (id: string) =>
      (byId.get(id)?.content as { type: string; text?: string }[])
        .map((item) => item.text ?? '')
        .join('');

    expect(plain('legacy-authors-edited')).toContain('written by Alice');
    expect(plain('legacy-authors-alice')).toContain('completed by Bob');
    expect(byId.get('legacy-authors-alice-todo')?.props).toMatchObject({
      checked: true,
    });
    expect(byId.get('legacy-authors-formatted')?.content).toContainEqual({
      type: 'text',
      text: 'word',
      styles: { bold: true },
    });
    expect(byId.has('legacy-authors-deleted')).toBe(false);
    expect(byId.get('legacy-authors-chloe')?.type).toBe('callout');
    expect(byId.get('legacy-authors-chloe-table')?.type).toBe('table');
    expect([...commentedThreads(editor).keys()]).toEqual([
      '6c0d1d6e-7a3e-4c5e-9a51-0000000000c3',
    ]);
  });

  it('writes "Version history" from its edits alone', () => {
    const legacyDocument = LEGACY_DOCUMENTS.find(
      ({ id }) => id === LEGACY_HISTORY_ID,
    ) as LegacyDocument;
    const { result } = writeEdits(legacyDocument, undefined);

    const ids = openWithYjs14(result).document.map(({ id }) => id);

    expect(ids).toEqual([
      'legacy-history-title',
      'legacy-history-intro',
      'legacy-history-goals',
      'legacy-history-goal-2',
      'legacy-history-goal-3',
      'legacy-history-task-1',
      'legacy-history-task-2',
      'legacy-history-next',
      'legacy-history-next-1',
      'legacy-history-next-2',
      'legacy-history-conclusion',
    ]);
  });

  // The backend is not in the frontend container: checked where both are.
  it.skipIf(!fs.existsSync(FIXTURE) || process.env.WRITE_LEGACY_DOCUMENTS)(
    'matches the fixture the preview environments are seeded with',
    () => {
      const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as {
        documents: {
          id: string;
          revisions: string[];
          edits: { update: string }[];
        }[];
      };
      const editor = createLegacyEditor();

      expect(fixture.documents.map(({ id }) => id)).toEqual(
        LEGACY_DOCUMENTS.map(({ id }) => id),
      );
      fixture.documents.forEach(({ revisions, edits }, index) => {
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

        // the committed edits apply to the committed legacy state
        const legacy = generated.revisions.at(-1);
        const committed = revisions.at(-1);
        const { edits: generatedEdits } = writeEdits(
          LEGACY_DOCUMENTS[index],
          legacy,
        );
        expect(
          applyEdits(
            committed ? fromBase64(committed) : undefined,
            edits.map(({ update }) => fromBase64(update)),
          ).document,
          'Regenerate it with `yarn legacy-documents`',
        ).toEqual(
          applyEdits(
            legacy,
            generatedEdits.map(({ update }) => update),
          ).document,
        );
      });
    },
  );

  it.runIf(process.env.WRITE_LEGACY_DOCUMENTS)(
    'writes the fixture the preview environments are seeded with',
    () => {
      const editor = createLegacyEditor();
      const userId = (user: LegacyUser) => LEGACY_USERS[user].id;
      const documents = LEGACY_DOCUMENTS.map((legacyDocument) => {
        const { revisions } = writeWithYjs13(editor, legacyDocument);
        const { edits } = writeEdits(legacyDocument, revisions.at(-1));
        return {
          id: legacyDocument.id,
          title: legacyDocument.title,
          parent_id: legacyDocument.parentId ?? null,
          revisions: revisions.map((revision) => toBase64(revision)),
          attachments: legacyDocument.attachments ?? [],
          threads: [
            ...(legacyDocument.threads ?? []).map(({ id, comment }) => ({
              id,
              comment,
              creator_id: null,
            })),
            ...(legacyDocument.edits ?? []).flatMap(({ user, thread }) =>
              thread
                ? [
                    {
                      id: thread.id,
                      comment: thread.comment,
                      creator_id: userId(user),
                    },
                  ]
                : [],
            ),
          ],
          edits: edits.map(({ user, minutesAgo, update }) => ({
            user_id: userId(user),
            minutes_ago: minutesAgo ?? null,
            update: toBase64(update),
          })),
        };
      });

      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(
        FIXTURE,
        `${JSON.stringify(
          {
            generated_by:
              'src/frontend/apps/impress/src/features/docs/doc-editor/__tests__/legacyDocuments.test.ts',
            owner: { id: LEGACY_OWNER.id, full_name: LEGACY_OWNER.fullName },
            users: Object.values(LEGACY_USERS).map(
              ({ id, email, fullName }) => ({
                id,
                email,
                full_name: fullName,
              }),
            ),
            documents,
          },
          null,
          2,
        )}\n`,
      );
    },
  );
});
