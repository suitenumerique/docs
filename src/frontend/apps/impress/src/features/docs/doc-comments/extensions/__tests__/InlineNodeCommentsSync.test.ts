/**
 * The comments of the inline nodes against the Yjs 14 sync binding, with the
 * schema and the inline contents of Docs and the cursor plugin a provider
 * brings: the setup that froze the tab, which the lighter setup of
 * `InlineNodeCommentsExtension.test.ts` does not reproduce.
 *
 * Writing the `commentMarks` attribute along with a mark kept the binding
 * correcting the document forever, in one synchronous loop. A guard filters
 * the binding's transactions past a limit, so that a regression fails here
 * instead of hanging the run.
 */
import { BlockNoteEditor, createExtension } from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { YjsThreadStore, withCollaboration } from '@blocknote/core/y';
import { Plugin } from '@tiptap/pm/state';
import { Awareness } from '@y/protocols/awareness';
import * as Y from '@y/y';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';

import {
  COMMENT_MARKS_PROP,
  InlineNodeCommentsExtension,
} from '../InlineNodeCommentsExtension';

const FRAGMENT = 'document-store';
// Far above what a burst of real changes dispatches.
const SYNC_TRANSACTIONS_LIMIT = 200;

let syncTransactions = 0;

const LoopGuard = createExtension(() => ({
  key: 'loopGuard',
  prosemirrorPlugins: [
    new Plugin({
      filterTransaction: (tr) => {
        if (tr.getMeta('y-sync-transaction') == null) {
          return true;
        }
        syncTransactions += 1;
        return syncTransactions <= SYNC_TRANSACTIONS_LIMIT;
      },
    }),
  ],
}));

const editors: BlockNoteEditor<any, any, any>[] = [];

beforeEach(() => {
  syncTransactions = 0;
});

afterEach(() => {
  editors.splice(0).forEach((editor) => editor._tiptapEditor.destroy());
});

const createThreadStore = () =>
  new YjsThreadStore(
    'user',
    new Y.Doc().get('threads'),
    new DefaultThreadStoreAuth('user', 'editor'),
  );

const createEditor = (ydoc: Y.Doc, threadStore = createThreadStore()) => {
  const editor = BlockNoteEditor.create(
    withCollaboration({
      schema: blockNoteSchema,
      collaboration: {
        fragment: ydoc.get(FRAGMENT),
        user: { name: 'user', color: '#000000' },
        provider: { awareness: new Awareness(ydoc) } as never,
      },
      extensions: [
        CommentsExtension({ threadStore, resolveUsers: async () => [] }),
        InlineNodeCommentsExtension(),
        LoopGuard(),
      ],
    }),
  );
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor.mount(element);
  editors.push(editor);
  return editor;
};

const writeMention = (editor: ReturnType<typeof createEditor>) =>
  editor.replaceBlocks(editor.document, [
    {
      type: 'paragraph',
      content: [
        {
          type: 'userMentionInline',
          props: { userId: 'user-1', fullName: 'Alice' },
        },
        ' commented',
      ],
    },
  ]);

const commentAll = (
  editor: ReturnType<typeof createEditor>,
  threadId: string,
) =>
  editor.transact((tr) => {
    const mark = editor.pmSchema.mark('comment', { threadId, orphan: false });
    tr.doc.descendants((node, pos) => {
      if (node.type.name === 'userMentionInline') {
        tr.addNodeMark(pos, mark);
      } else if (node.isText) {
        tr.addMark(pos, pos + node.nodeSize, mark);
      }
    });
  });

const mentionComments = (editor: ReturnType<typeof createEditor>) => {
  const comments: unknown[] = [];
  editor.prosemirrorState.doc.descendants((node) => {
    if (node.type.name === 'userMentionInline') {
      node.marks
        .filter((mark) => mark.type.name === 'comment')
        .forEach((mark) => comments.push(mark.attrs));
    }
  });
  return comments;
};

const findMentionElement = (ydoc: Y.Doc) => {
  const find = (parent: Y.Node): Y.Node | undefined => {
    for (const child of parent.toArray()) {
      if (child instanceof Y.Node) {
        const found = child.name === 'userMentionInline' ? child : find(child);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };
  const element = find(ydoc.get(FRAGMENT));
  if (!element) {
    throw new Error('No mention element');
  }
  return element;
};

describe('InlineNodeCommentsExtension with the sync binding', () => {
  it('comments a mention, and follows the state of its thread', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeMention(editor);
    const { id: threadId } = await threadStore.createThread({
      initialComment: { body: [] },
    });

    commentAll(editor, threadId);
    await threadStore.resolveThread({ threadId });
    await threadStore.unresolveThread({ threadId });

    expect(syncTransactions).toBeLessThan(SYNC_TRANSACTIONS_LIMIT);
    expect(mentionComments(editor)).toEqual([{ threadId, orphan: false }]);
  });

  it('restores a comment kept in the attribute of a document written before', () => {
    const source = new Y.Doc();
    writeMention(createEditor(source));
    findMentionElement(source).setAttr(
      COMMENT_MARKS_PROP,
      JSON.stringify([{ threadId: 'thread-1', orphan: false }]),
    );
    syncTransactions = 0;

    // the content reaches the editor once mounted, as from the websocket
    const ydoc = new Y.Doc();
    const editor = createEditor(ydoc);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(source));
    editor.transact((tr) => tr.insertText('typed ', 1));

    expect(syncTransactions).toBeLessThan(SYNC_TRANSACTIONS_LIMIT);
    expect(mentionComments(editor)).toEqual([
      { threadId: 'thread-1', orphan: false },
    ]);
  });
});
