import {
  BlockNoteEditor,
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  defaultProps,
} from '@blocknote/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';

import { CalloutBlockShortcuts } from '../CalloutBlock';

// Use a DOM renderer so the real editor keymaps can run without React UI.
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: createBlockSpec(
      {
        type: 'callout',
        propSchema: {
          textAlignment: defaultProps.textAlignment,
          backgroundColor: defaultProps.backgroundColor,
          emoji: { default: '💡' },
        },
        content: 'inline',
      },
      {
        render: () => {
          const dom = document.createElement('div');
          return { dom, contentDOM: dom };
        },
      },
      [CalloutBlockShortcuts],
    )(),
  },
});

function createEditor(content = '', backgroundColor = 'yellow') {
  const editor = BlockNoteEditor.create({
    schema,
    initialContent: [
      {
        id: 'callout',
        type: 'callout',
        props: { backgroundColor, textAlignment: 'center' },
        content,
      },
    ],
  });
  editor.mount(document.createElement('div'));
  editor.setTextCursorPosition('callout', 'start');
  return editor;
}

type Editor = ReturnType<typeof createEditor>;
let editor: Editor | undefined;

function backspace(editor: Editor) {
  const view = editor.prosemirrorView;
  return view.someProp('handleKeyDown', (handler) =>
    handler(view, new KeyboardEvent('keydown', { key: 'Backspace' })),
  );
}

afterEach(() => {
  editor?._tiptapEditor.destroy();
  editor = undefined;
});

describe('callout Backspace', () => {
  it.each(['yellow', 'blue', 'default'])(
    'clears the %s background when an empty callout becomes a paragraph',
    (color) => {
      editor = createEditor('', color);
      backspace(editor);

      expect(editor.document[0]).toMatchObject({
        id: 'callout',
        type: 'paragraph',
        props: { backgroundColor: 'default', textAlignment: 'center' },
        content: [],
      });
    },
  );

  it('preserves text when converting at the start of a nonempty callout', () => {
    editor = createEditor('Keep this text');
    backspace(editor);

    expect(editor.document[0]).toMatchObject({
      type: 'paragraph',
      props: { backgroundColor: 'default' },
      content: [{ type: 'text', text: 'Keep this text' }],
    });
  });

  it('leaves character deletion inside a callout to the editor', () => {
    editor = createEditor('Text');
    editor.setTextCursorPosition('callout', 'end');
    expect(backspace(editor)).toBeFalsy();

    expect(editor.document[0]).toMatchObject({
      type: 'callout',
      props: { backgroundColor: 'yellow' },
    });
  });

  it('deletes selected text without converting the callout', () => {
    editor = createEditor('Text');
    const view = editor.prosemirrorView;
    const start = view.state.selection.from;
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, start, start + 4),
      ),
    );
    backspace(editor);

    expect(editor.document[0]).toMatchObject({
      type: 'callout',
      props: { backgroundColor: 'yellow' },
      content: [],
    });
  });

  it('does not clear the background of an ordinary paragraph', () => {
    editor = createEditor();
    editor.updateBlock('callout', { type: 'paragraph' });
    editor.setTextCursorPosition('callout', 'start');
    backspace(editor);

    expect(editor.document[0]).toMatchObject({
      type: 'paragraph',
      props: { backgroundColor: 'yellow' },
    });
  });

  it('restores the callout and its background in one undo', () => {
    editor = createEditor('Text', 'blue');
    backspace(editor);
    editor.undo();

    expect(editor.document[0]).toMatchObject({
      type: 'callout',
      props: { backgroundColor: 'blue' },
      content: [{ type: 'text', text: 'Text' }],
    });
  });
});
