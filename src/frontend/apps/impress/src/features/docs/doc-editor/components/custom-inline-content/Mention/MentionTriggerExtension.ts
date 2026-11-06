import { createExtension } from '@blocknote/core';
import { EditorState, Plugin } from '@tiptap/pm/state';

export const MENTION_TRIGGER = '@';

/**
 * "@" opens the search at the start of a line or after a space only, so that
 * an email address is still typed as plain text.
 */
export const canOpenMentionSearch = (state: EditorState) => {
  const { $from } = state.selection;

  if ($from.parent.type.spec.code) {
    return false;
  }

  const charBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 1),
    $from.parentOffset,
  );

  return charBefore === '' || /\s/.test(charBefore);
};

/**
 * Opens the search of the mentions when "@" is typed. It is carried by the
 * spec of the search, so every editor having it in its schema gets it: the
 * doc and the comments.
 *
 * The key is compared with `event.key` rather than bound in a keymap: "@" is
 * typed with AltGr on some layouts (AZERTY), which a keymap reads as Ctrl-Alt.
 */
export const MentionTriggerExtension = createExtension(({ editor }) => ({
  key: 'mentionTrigger',
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleKeyDown: (view, event) => {
          if (
            event.key !== MENTION_TRIGGER ||
            !view.editable ||
            view.composing ||
            !canOpenMentionSearch(view.state)
          ) {
            return false;
          }

          editor.insertInlineContent([
            {
              type: 'mentionSearchInline',
              props: { trigger: MENTION_TRIGGER },
            },
          ]);

          return true;
        },
      },
    }),
  ],
}));
