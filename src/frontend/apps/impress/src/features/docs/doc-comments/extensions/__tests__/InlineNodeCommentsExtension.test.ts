import {
  BlockNoteEditor,
  BlockNoteSchema,
  createInlineContentSpec,
  defaultInlineContentSpecs,
} from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { YjsThreadStore, withCollaboration } from '@blocknote/core/yjs';
import { createReactInlineMathSpec } from '@blocknote/math-block';
import { Node } from '@tiptap/pm/model';
import { afterEach, describe, expect, it } from 'vitest';
import { yUndoPluginKey } from 'y-prosemirror';
import * as Y from 'yjs';

import {
  COMMENT_MARKS_PROP,
  InlineNodeCommentsExtension,
  inlineNodeCommentsPropSchema,
} from '../InlineNodeCommentsExtension';

const FRAGMENT = 'document-store';

// An inline node without content, like a doc link or a user mention.
const atomSpec = createInlineContentSpec(
  {
    type: 'atom',
    propSchema: { ...inlineNodeCommentsPropSchema },
    content: 'none',
  },
  {
    render: () => ({ dom: document.createElement('span') }),
  },
);

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    atom: atomSpec,
    math: createReactInlineMathSpec(),
  },
});

const editors: BlockNoteEditor<any, any, any>[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor._tiptapEditor.destroy());
});

const createThreadStore = () =>
  new YjsThreadStore(
    'user',
    new Y.Doc().getMap('threads'),
    new DefaultThreadStoreAuth('user', 'editor'),
  );

const createEditor = (
  ydoc: Y.Doc,
  threadStore: YjsThreadStore = createThreadStore(),
) => {
  const editor = BlockNoteEditor.create(
    withCollaboration({
      schema,
      collaboration: {
        fragment: ydoc.getXmlFragment(FRAGMENT),
        user: { name: 'user', color: '#000000' },
        provider: undefined,
      },
      extensions: [
        CommentsExtension({ threadStore, resolveUsers: async () => [] }),
        InlineNodeCommentsExtension(),
      ],
    }),
  );
  editor.mount(document.createElement('div'));
  editors.push(editor);
  return editor;
};

// A new client loading the same document from the server.
const reload = (ydoc: Y.Doc) => {
  const reloaded = new Y.Doc();
  Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(ydoc));
  return reloaded;
};

const findNode = (editor: BlockNoteEditor<any, any, any>, type: string) => {
  let found: Node | undefined;
  editor.prosemirrorState.doc.descendants((node) => {
    if (!found && node.type.name === type) {
      found = node;
    }
    return !found;
  });
  if (!found) {
    throw new Error(`No ${type} node`);
  }
  return found;
};

const findYElement = (ydoc: Y.Doc, nodeName: string) => {
  const [element] = ydoc
    .getXmlFragment(FRAGMENT)
    .createTreeWalker(
      (type) => type instanceof Y.XmlElement && type.nodeName === nodeName,
    );
  if (!(element instanceof Y.XmlElement)) {
    throw new Error(`No ${nodeName} element`);
  }
  return element;
};

const commentsOf = (node: Node) =>
  node.marks
    .filter((mark) => mark.type.name === 'comment')
    .map((mark) => mark.attrs);

const firstParagraphRange = (editor: BlockNoteEditor<any, any, any>) => {
  let from = 0;
  let to = 0;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (!to && node.type.name === 'paragraph') {
      from = pos + 1;
      to = pos + node.nodeSize - 1;
    }
    return !to;
  });
  return { from, to };
};

// Selects the whole first paragraph, so the comment covers the text and the
// inline nodes, as when a user selects a sentence with a doc link.
const commentFirstParagraph = (
  editor: BlockNoteEditor<any, any, any>,
  threadId: string,
) => {
  editor._tiptapEditor
    .chain()
    .setTextSelection(firstParagraphRange(editor))
    .setMark('comment', { orphan: false, threadId })
    .run();
};

const writeContent = (editor: BlockNoteEditor<any, any, any>) => {
  editor.replaceBlocks(editor.document, [
    {
      type: 'paragraph',
      content: [
        'See ',
        { type: 'atom', props: {} },
        ' and ',
        { type: 'math', content: 'x^2' },
      ],
    },
  ]);
};

const createThread = async (threadStore: YjsThreadStore) =>
  (await threadStore.createThread({ initialComment: { body: [] } })).id;

describe('InlineNodeCommentsExtension', () => {
  it('keeps the comment of an inline node after a reload', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeContent(editor);
    const threadId = await createThread(threadStore);

    commentFirstParagraph(editor, threadId);

    expect(commentsOf(findNode(editor, 'atom'))).toEqual([
      { threadId, orphan: false },
    ]);
    expect(findYElement(ydoc, 'atom').getAttribute(COMMENT_MARKS_PROP)).toBe(
      JSON.stringify([{ threadId, orphan: false }]),
    );

    const reloaded = createEditor(reload(ydoc), threadStore);

    expect(commentsOf(findNode(reloaded, 'atom'))).toEqual([
      { threadId, orphan: false },
    ]);
    expect(commentsOf(findNode(reloaded, 'text'))).toEqual([
      { threadId, orphan: false },
    ]);
    expect(
      reloaded
        .getExtension(CommentsExtension)
        ?.store.state.threadPositions.has(threadId),
    ).toBe(true);
  });

  it('keeps the comment of an inline math after a reload', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeContent(editor);
    const threadId = await createThread(threadStore);

    commentFirstParagraph(editor, threadId);

    const reloaded = createEditor(reload(ydoc), threadStore);
    const math = findNode(reloaded, 'math');

    // The comment of an inline math is on its text, that Yjs already stores.
    expect(math.attrs).not.toHaveProperty(COMMENT_MARKS_PROP);
    expect(math.textContent).toBe('x^2');
    expect(commentsOf(math.firstChild!)).toEqual([{ threadId, orphan: false }]);
  });

  it('keeps the resolved state of the comment', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeContent(editor);
    const threadId = await createThread(threadStore);
    commentFirstParagraph(editor, threadId);

    await threadStore.resolveThread({ threadId });

    expect(commentsOf(findNode(editor, 'atom'))).toEqual([
      { threadId, orphan: true },
    ]);
    expect(findYElement(ydoc, 'atom').getAttribute(COMMENT_MARKS_PROP)).toBe(
      JSON.stringify([{ threadId, orphan: true }]),
    );

    // Without the threads, so the orphan state can only come from Yjs.
    const reloaded = createEditor(reload(ydoc));

    expect(commentsOf(findNode(reloaded, 'atom'))).toEqual([
      { threadId, orphan: true },
    ]);
  });

  it('forgets the comment once removed', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeContent(editor);
    commentFirstParagraph(editor, await createThread(threadStore));

    editor._tiptapEditor
      .chain()
      .setTextSelection(firstParagraphRange(editor))
      .unsetMark('comment')
      .run();

    expect(findYElement(ydoc, 'atom').getAttribute(COMMENT_MARKS_PROP)).toBe(
      '',
    );
    expect(
      commentsOf(findNode(createEditor(reload(ydoc), threadStore), 'atom')),
    ).toEqual([]);
  });

  it('shows the comment to the collaborators', async () => {
    const ydoc = new Y.Doc();
    const peerYdoc = new Y.Doc();
    ydoc.on('update', (update: Uint8Array) => Y.applyUpdate(peerYdoc, update));
    peerYdoc.on('update', (update: Uint8Array) => Y.applyUpdate(ydoc, update));
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    const peer = createEditor(peerYdoc, threadStore);
    writeContent(editor);
    const threadId = await createThread(threadStore);

    commentFirstParagraph(editor, threadId);

    expect(commentsOf(findNode(peer, 'atom'))).toEqual([
      { threadId, orphan: false },
    ]);
  });

  it('undoes and redoes the comment of an inline node', async () => {
    const ydoc = new Y.Doc();
    const threadStore = createThreadStore();
    const editor = createEditor(ydoc, threadStore);
    writeContent(editor);
    const threadId = await createThread(threadStore);
    yUndoPluginKey
      .getState(editor.prosemirrorState)
      ?.undoManager.stopCapturing();

    commentFirstParagraph(editor, threadId);
    editor.undo();

    expect(commentsOf(findNode(editor, 'atom'))).toEqual([]);
    expect(commentsOf(findNode(editor, 'text'))).toEqual([]);
    expect(findYElement(ydoc, 'atom').getAttribute(COMMENT_MARKS_PROP)).toBe(
      '',
    );

    editor.redo();

    expect(commentsOf(findNode(editor, 'atom'))).toEqual([
      { threadId, orphan: false },
    ]);
  });

  it.each(['{x', '{}', '[{"threadId":5}]', '[{"orphan":true}]'])(
    'ignores the invalid stored value %s',
    (value) => {
      const ydoc = new Y.Doc();
      writeContent(createEditor(ydoc));
      findYElement(ydoc, 'atom').setAttribute(COMMENT_MARKS_PROP, value);

      const reloaded = reload(ydoc);
      const editor = createEditor(reloaded);

      expect(commentsOf(findNode(editor, 'atom'))).toEqual([]);
      // y-prosemirror deletes an element that it cannot build.
      expect(findYElement(reloaded, 'atom')).toBeInstanceOf(Y.XmlElement);
    },
  );
});
