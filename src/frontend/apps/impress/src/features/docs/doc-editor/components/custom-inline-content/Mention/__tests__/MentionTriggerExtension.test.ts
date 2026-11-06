import {
  BlockNoteEditor,
  BlockNoteSchema,
  createInlineContentSpec,
  defaultInlineContentSpecs,
} from '@blocknote/core';
import { afterEach, describe, expect, it } from 'vitest';

import { MentionTriggerExtension } from '../MentionTriggerExtension';

// A DOM render of the search, so that the real keymaps of the editor run
// without the React UI.
const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mentionSearchInline: createInlineContentSpec(
      {
        type: 'mentionSearchInline',
        propSchema: { trigger: { default: '/', values: ['/', '@'] } },
        content: 'none',
      },
      { render: () => ({ dom: document.createElement('span') }) },
      [MentionTriggerExtension()],
    ),
  },
});

const createEditor = (content: string, { editable = true } = {}) => {
  const editor = BlockNoteEditor.create({
    schema,
    initialContent: [{ id: 'block', type: 'paragraph', content }],
  });
  editor.mount(document.createElement('div'));
  editor.isEditable = editable;
  editor.setTextCursorPosition('block', 'end');
  return editor;
};

type Editor = ReturnType<typeof createEditor>;
let editor: Editor | undefined;

const typeAt = (editor: Editor) => {
  const view = editor.prosemirrorView;
  return view.someProp('handleKeyDown', (handler) =>
    handler(view, new KeyboardEvent('keydown', { key: '@' })),
  );
};

const inlineTypes = (editor: Editor) =>
  (editor.document[0].content as { type: string }[]).map(({ type }) => type);

afterEach(() => {
  editor?._tiptapEditor.destroy();
  editor = undefined;
});

describe('MentionTriggerExtension', () => {
  it('opens the search of the mentions at the start of a line', () => {
    editor = createEditor('');

    expect(typeAt(editor)).toBe(true);
    expect(editor.document[0].content).toMatchObject([
      { type: 'mentionSearchInline', props: { trigger: '@' } },
    ]);
  });

  it('opens the search of the mentions after a space', () => {
    editor = createEditor('Hello ');

    expect(typeAt(editor)).toBe(true);
    expect(inlineTypes(editor)).toEqual(['text', 'mentionSearchInline']);
  });

  it('lets "@" be typed in a word, e.g. an email address', () => {
    editor = createEditor('john');

    expect(typeAt(editor)).toBeFalsy();
    expect(inlineTypes(editor)).toEqual(['text']);
  });

  it('does nothing when the editor is read-only', () => {
    editor = createEditor('', { editable: false });

    expect(typeAt(editor)).toBeFalsy();
    expect(editor.document[0].content).toEqual([]);
  });
});
