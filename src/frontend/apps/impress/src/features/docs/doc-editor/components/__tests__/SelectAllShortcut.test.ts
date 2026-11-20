import { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { AllSelection, TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';

import { SelectAllShortcut } from '../SelectAllShortcut';

const VIDEO_URL = 'https://example.com/video.mp4';

function createEditor(initialContent: PartialBlock[]) {
  const editor = BlockNoteEditor.create({
    initialContent,
    extensions: [SelectAllShortcut],
  });
  editor.mount(document.createElement('div'));
  return editor;
}

type Editor = ReturnType<typeof createEditor>;
let editor: Editor | undefined;

function selectAll(editor: Editor) {
  const view = editor.prosemirrorView;
  // jsdom is not a Mac: the "Mod" of the keymaps is Ctrl
  return view.someProp('handleKeyDown', (handler) =>
    handler(view, new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })),
  );
}

afterEach(() => {
  editor?._tiptapEditor.destroy();
  editor = undefined;
});

describe('Mod-a', () => {
  it('selects the content of the current block first', () => {
    editor = createEditor([
      { id: 'first', type: 'paragraph', content: 'First' },
      { id: 'second', type: 'paragraph', content: 'Second' },
    ]);
    editor.setTextCursorPosition('second', 'start');

    expect(selectAll(editor)).toBe(true);

    const { selection } = editor.prosemirrorState;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(
      editor.prosemirrorState.doc.textBetween(selection.from, selection.to),
    ).toBe('Second');
  });

  it('selects the whole document when the block is already selected', () => {
    editor = createEditor([
      { id: 'first', type: 'paragraph', content: 'First' },
      { id: 'second', type: 'paragraph', content: 'Second' },
    ]);
    editor.setTextCursorPosition('second', 'start');

    selectAll(editor);
    selectAll(editor);

    expect(editor.prosemirrorState.selection).toBeInstanceOf(AllSelection);
  });

  it.each([
    ['ends', [{ type: 'heading', content: 'Title' }, { type: 'video' }]],
    ['starts', [{ type: 'video' }, { type: 'heading', content: 'Title' }]],
  ] as const)(
    'includes a video block that %s the document',
    (_position, blocks) => {
      editor = createEditor(
        blocks.map((block) =>
          block.type === 'video'
            ? { ...block, id: 'video', props: { url: VIDEO_URL } }
            : { ...block, id: 'title' },
        ),
      );
      editor.setTextCursorPosition('title', 'start');

      selectAll(editor);
      selectAll(editor);

      const { doc, selection } = editor.prosemirrorState;
      expect(selection).toBeInstanceOf(AllSelection);
      expect(selection.from).toBe(0);
      expect(selection.to).toBe(doc.content.size);
    },
  );

  it('selects the whole document at once from an empty block', () => {
    editor = createEditor([
      { id: 'first', type: 'paragraph', content: 'First' },
      { id: 'empty', type: 'paragraph' },
    ]);
    editor.setTextCursorPosition('empty', 'start');

    selectAll(editor);

    expect(editor.prosemirrorState.selection).toBeInstanceOf(AllSelection);
  });

  it('leaves an empty document behind on delete', () => {
    editor = createEditor([
      { type: 'checkListItem', content: 'Task' },
      { id: 'text', type: 'paragraph', content: 'Text' },
      { type: 'video', props: { url: VIDEO_URL } },
    ]);
    editor.setTextCursorPosition('text', 'start');

    selectAll(editor);
    selectAll(editor);
    const view = editor.prosemirrorView;
    view.dispatch(view.state.tr.deleteSelection());

    expect(editor.document).toHaveLength(1);
    expect(editor.document[0]).toMatchObject({
      type: 'paragraph',
      content: [],
    });
  });
});
