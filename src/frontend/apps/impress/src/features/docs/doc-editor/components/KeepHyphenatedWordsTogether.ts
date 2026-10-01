import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}]/u;

const getCharacterAt = (text: string, index: number) => {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? '' : String.fromCodePoint(codePoint);
};

const readWord = (text: string, start: number) => {
  let cursor = start;

  while (cursor < text.length) {
    const character = getCharacterAt(text, cursor);
    if (!WORD_CHARACTER.test(character)) {
      break;
    }
    cursor += character.length;
  }

  return cursor;
};

export const getHyphenatedWordRanges = (text: string) => {
  const ranges: Array<{ from: number; to: number }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = cursor;
    cursor = readWord(text, cursor);

    if (cursor === start) {
      const character = getCharacterAt(text, cursor);
      cursor += character.length;
      continue;
    }

    let end: number | undefined;
    while (text[cursor] === '-') {
      const nextSegmentStart = cursor + 1;
      const nextSegmentEnd = readWord(text, nextSegmentStart);
      if (nextSegmentEnd === nextSegmentStart) {
        break;
      }

      cursor = nextSegmentEnd;
      end = cursor;
    }

    if (end !== undefined) {
      ranges.push({ from: start, to: end });
    }
  }

  return ranges;
};

const pluginKey = new PluginKey<DecorationSet>('keepHyphenatedWordsTogether');

export const createHyphenatedWordDecorations = (doc: ProseMirrorNode) => {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isTextblock) {
      return;
    }

    let run = '';
    let runStart = 0;

    const decorateRun = () => {
      getHyphenatedWordRanges(run).forEach(({ from, to }) => {
        decorations.push(
          Decoration.inline(
            position + 1 + runStart + from,
            position + 1 + runStart + to,
            {
              class: 'bn-hyphenated-word',
            },
          ),
        );
      });
    };

    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        if (!run) {
          runStart = offset;
        }
        run += child.text;
        return;
      }

      decorateRun();
      run = '';
    });

    decorateRun();
    return false;
  });

  return DecorationSet.create(doc, decorations);
};

export const KeepHyphenatedWordsTogether = Extension.create({
  name: 'keepHyphenatedWordsTogether',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: (_, state) => createHyphenatedWordDecorations(state.doc),
          apply: (transaction, decorations) =>
            transaction.docChanged
              ? createHyphenatedWordDecorations(transaction.doc)
              : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => pluginKey.getState(state) ?? null,
        },
      }),
    ];
  },
});
