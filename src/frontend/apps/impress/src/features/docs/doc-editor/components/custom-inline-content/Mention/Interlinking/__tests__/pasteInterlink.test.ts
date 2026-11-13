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
import { YjsThreadStore } from '@blocknote/core/yjs';
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import {
  getPastedDocInterlink,
  insertPastedDocInterlink,
} from '../pasteInterlink';

const VALID_DOC_ID = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

const makeEditor = (
  opts: {
    selectedText?: string;
    inSameBlock?: boolean;
    inCodeBlock?: boolean;
    hasInlineNode?: boolean;
  } = {},
) => {
  const {
    selectedText = '',
    inSameBlock = true,
    inCodeBlock = false,
    hasInlineNode = false,
  } = opts;
  const parent = { type: { spec: { code: inCodeBlock } } };

  const tr = {
    selection: {
      empty: !selectedText,
      from: 0,
      to: selectedText.length,
      $from: { parent, sameParent: () => inSameBlock },
      $to: { parent },
    },
    doc: {
      textBetween: () => selectedText,
      nodesBetween: (
        _from: number,
        _to: number,
        callback: (node: { isInline: boolean; isText: boolean }) => boolean,
      ) => {
        callback({ isInline: true, isText: true });
        if (hasInlineNode) {
          callback({ isInline: true, isText: false });
        }
      },
    },
  };

  return {
    transact: (fn: (transaction: typeof tr) => unknown) => fn(tr),
  } as unknown as DocsBlockNoteEditor;
};

const makeClipboardEvent = (text: string | undefined) =>
  ({
    clipboardData: {
      getData: () => text,
    },
  }) as unknown as ClipboardEvent;

describe('getPastedDocInterlink', () => {
  it('keeps the selected text as the label of the link', () => {
    const editor = makeEditor({ selectedText: '  see there ' });
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/#block-1`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
      blockId: 'block-1',
      label: 'see there',
    });
  });

  it('returns null for a selection across blocks or without text', () => {
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(
      getPastedDocInterlink(
        makeClipboardEvent(url),
        makeEditor({ selectedText: 'two blocks', inSameBlock: false }),
      ),
    ).toBeNull();
    expect(
      getPastedDocInterlink(
        makeClipboardEvent(url),
        makeEditor({ selectedText: '   ' }),
      ),
    ).toBeNull();
  });

  it('returns null for a selection holding an inline node, e.g. a doc link', () => {
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(
      getPastedDocInterlink(
        makeClipboardEvent(url),
        makeEditor({ selectedText: 'See ', hasInlineNode: true }),
      ),
    ).toBeNull();
  });

  it('returns null when the cursor is inside a code block', () => {
    const editor = makeEditor({ inCodeBlock: true });
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the clipboard has no text', () => {
    const editor = makeEditor();

    expect(
      getPastedDocInterlink(makeClipboardEvent(undefined), editor),
    ).toBeNull();
    expect(getPastedDocInterlink(makeClipboardEvent(''), editor)).toBeNull();
    expect(getPastedDocInterlink(makeClipboardEvent('   '), editor)).toBeNull();
  });

  it('returns null when the pasted text contains whitespace', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(
      getPastedDocInterlink(makeClipboardEvent(`some text ${url}`), editor),
    ).toBeNull();
  });

  it('returns null when the pasted text is not a valid URL', () => {
    const editor = makeEditor();

    expect(
      getPastedDocInterlink(makeClipboardEvent('not-a-url'), editor),
    ).toBeNull();
    expect(
      getPastedDocInterlink(
        makeClipboardEvent(`/docs/${VALID_DOC_ID}/`),
        editor,
      ),
    ).toBeNull();
  });

  it('returns null for a URL on a different origin', () => {
    const editor = makeEditor();
    const url = `https://not-the-same-origin.example/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the path is not a doc route', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/settings/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the doc id in the path is not a valid uuid', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/not-a-uuid/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns the doc id for a same-origin doc URL with a trailing slash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
    });
  });

  it('returns the doc id for a same-origin doc URL without a trailing slash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
    });
  });

  it('returns the doc id when the URL has a query string or hash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/?foo=bar#section`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
      blockId: 'section',
    });
  });

  it('returns the block id from the URL hash when present', () => {
    const editor = makeEditor();
    const blockId = '0b0566d8-56d3-4901-8163-d887c3c3bc0c';
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/#${blockId}`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
      blockId,
    });
  });
});

describe('insertPastedDocInterlink', () => {
  const createEditor = () => {
    const schema = BlockNoteSchema.create({
      inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        interlinkingLinkInline: createInlineContentSpec(
          {
            type: 'interlinkingLinkInline',
            propSchema: {
              docId: { default: '' },
              blockId: { default: '' },
              label: { default: '' },
            },
            content: 'none',
          },
          { render: () => ({ dom: document.createElement('span') }) },
        ),
      },
    });
    const threadStore = new YjsThreadStore(
      'user',
      new Y.Doc().getMap('threads'),
      new DefaultThreadStoreAuth('user', 'editor'),
    );
    const editor = BlockNoteEditor.create({
      schema,
      extensions: [
        CommentsExtension({ threadStore, resolveUsers: async () => [] }),
      ],
    });
    editor.mount(document.createElement('div'));
    return editor;
  };

  const findInterlink = (editor: BlockNoteEditor<any, any, any>) => {
    let found: Node | undefined;
    editor.prosemirrorState.doc.descendants((node) => {
      found ??= node.type.name === 'interlinkingLinkInline' ? node : undefined;
      return !found;
    });
    return found;
  };

  const getParagraphStart = (editor: BlockNoteEditor<any, any, any>) => {
    let start = 0;
    editor.prosemirrorState.doc.descendants((node, pos) => {
      start ||= node.type.name === 'paragraph' ? pos + 1 : 0;
      return !start;
    });
    return start;
  };

  it('keeps the whitespace around the selected text', () => {
    const editor = createEditor();
    editor.replaceBlocks(editor.document, [
      { type: 'paragraph', content: 'Read this now' },
    ]);
    // " this ", with the spaces around it
    const from = getParagraphStart(editor) + 'Read'.length;
    editor._tiptapEditor.commands.setTextSelection({
      from,
      to: from + ' this '.length,
    });

    insertPastedDocInterlink(editor as unknown as DocsBlockNoteEditor, {
      docId: VALID_DOC_ID,
      label: 'this',
    });

    expect(findInterlink(editor)?.attrs.label).toBe('this');
    expect(editor.prosemirrorState.doc.textContent).toBe('Read  now');

    editor._tiptapEditor.destroy();
  });

  it('moves the comment of the replaced text onto the link', () => {
    const editor = createEditor();
    editor.replaceBlocks(editor.document, [
      { type: 'paragraph', content: 'Read this now' },
    ]);
    const from = getParagraphStart(editor) + 'Read '.length;
    const to = from + 'this'.length;
    editor._tiptapEditor
      .chain()
      .setTextSelection({ from, to })
      .setMark('comment', { orphan: false, threadId: 'thread-1' })
      .run();

    insertPastedDocInterlink(editor as unknown as DocsBlockNoteEditor, {
      docId: VALID_DOC_ID,
      label: 'this',
    });

    const interlink = findInterlink(editor);
    expect(interlink?.attrs).toMatchObject({
      docId: VALID_DOC_ID,
      label: 'this',
    });
    expect(
      interlink?.marks
        .filter((mark) => mark.type.name === 'comment')
        .map((mark) => mark.attrs.threadId),
    ).toEqual(['thread-1']);
    expect(editor.prosemirrorState.doc.textContent).toBe('Read  now');

    editor._tiptapEditor.destroy();
  });
});
