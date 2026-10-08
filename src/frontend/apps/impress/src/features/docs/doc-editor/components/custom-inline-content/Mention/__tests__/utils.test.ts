import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { moveCursorAfterMention } from '../utils';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'inline*' },
    text: { group: 'inline' },
    mention: { group: 'inline', inline: true, atom: true },
  },
});

// <p>ab[mention]cd</p><p>ef</p>
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [
    schema.text('ab'),
    schema.node('mention'),
    schema.text('cd'),
  ]),
  schema.node('paragraph', null, [schema.text('ef')]),
]);

const MENTION_POS = 3;

const createEditor = (anchor: number) => {
  let state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, anchor),
  });

  const editor = {
    transact: (callback: (tr: typeof state.tr) => unknown) => {
      const tr = state.tr;
      const result = callback(tr);
      state = state.apply(tr);
      return result;
    },
  } as unknown as DocsBlockNoteEditor;

  return { editor, getSelection: () => state.selection };
};

describe('moveCursorAfterMention', () => {
  it.each([
    ['before the mention', 2],
    ['in another block', 9],
  ])('puts the cursor right after the mention, from %s', (_, anchor) => {
    const { editor, getSelection } = createEditor(anchor);

    moveCursorAfterMention(editor, MENTION_POS);

    expect(getSelection().empty).toBe(true);
    expect(getSelection().from).toBe(MENTION_POS + 1);
  });

  it('keeps the selection when there is no node at the position', () => {
    const { editor, getSelection } = createEditor(2);

    // The end of the doc, there is no node after it
    moveCursorAfterMention(editor, doc.content.size);

    expect(getSelection().from).toBe(2);
  });
});
