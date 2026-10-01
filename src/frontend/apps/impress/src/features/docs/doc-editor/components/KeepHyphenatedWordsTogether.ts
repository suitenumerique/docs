import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const HYPHENATED_WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)+/gu;

export const getHyphenatedWordRanges = (text: string) =>
  Array.from(text.matchAll(HYPHENATED_WORD_PATTERN), (match) => ({
    from: match.index,
    to: match.index + match[0].length,
  }));

const pluginKey = new PluginKey<DecorationSet>('keepHyphenatedWordsTogether');

const createDecorations = (doc: Parameters<typeof DecorationSet.create>[0]) => {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) {
      return;
    }

    getHyphenatedWordRanges(node.text).forEach(({ from, to }) => {
      decorations.push(
        Decoration.inline(position + from, position + to, {
          class: 'bn-hyphenated-word',
        }),
      );
    });
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
          init: (_, state) => createDecorations(state.doc),
          apply: (transaction, decorations) =>
            transaction.docChanged
              ? createDecorations(transaction.doc)
              : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => pluginKey.getState(state) ?? null,
        },
      }),
    ];
  },
});
