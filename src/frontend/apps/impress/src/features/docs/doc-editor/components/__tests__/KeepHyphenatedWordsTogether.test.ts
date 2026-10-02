import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { describe, expect, test } from 'vitest';

import {
  createHyphenatedWordDecorations,
  getHyphenatedWordRanges,
} from '../KeepHyphenatedWordsTogether';

describe('getHyphenatedWordRanges', () => {
  test('finds a hyphenated name at the correct position', () => {
    const text = 'Soleilnuit Lune, Jean-Marc Niche';

    expect(getHyphenatedWordRanges(text)).toEqual([
      {
        from: text.indexOf('Jean-Marc'),
        to: text.indexOf('Jean-Marc') + 'Jean-Marc'.length,
      },
    ]);
  });

  test('finds each compound word without including punctuation', () => {
    const text = 'well-known, up-to-date.';

    expect(
      getHyphenatedWordRanges(text).map(({ from, to }) => text.slice(from, to)),
    ).toEqual(['well-known', 'up-to-date']);
  });

  test('ignores dashes surrounded by spaces', () => {
    expect(getHyphenatedWordRanges('one - two')).toEqual([]);
  });

  test('scans long text without a hyphen', () => {
    expect(getHyphenatedWordRanges('a'.repeat(16_000))).toEqual([]);
  });

  test('decorates a hyphenated word across formatting boundaries', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          toDOM: () => ['p', 0],
        },
        text: { group: 'inline' },
      },
      marks: {
        strong: { toDOM: () => ['strong', 0] },
      },
    });
    const doc = schema.node('doc', undefined, [
      schema.node('paragraph', undefined, [
        schema.text('Jean', [schema.marks.strong.create()]),
        schema.text('-Marc'),
      ]),
    ]);
    const decorations = createHyphenatedWordDecorations(doc);

    expect(decorations.find()).toEqual([
      expect.objectContaining({ from: 1, to: 10 }),
    ]);

    const container = document.createElement('div');
    const view = new EditorView(container, {
      state: EditorState.create({
        doc,
        plugins: [
          new Plugin({
            props: { decorations: () => decorations },
          }),
        ],
      }),
    });
    const decoratedText = Array.from(
      container.querySelectorAll('.bn-hyphenated-word'),
      (element) => element.textContent,
    ).join('');

    expect(decoratedText).toBe('Jean-Marc');
    view.destroy();
  });
});
