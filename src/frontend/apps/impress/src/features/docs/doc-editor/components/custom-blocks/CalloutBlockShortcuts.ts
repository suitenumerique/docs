import { createExtension, defaultProps } from '@blocknote/core';

export const CalloutBlockShortcuts = createExtension({
  key: 'callout-shortcuts',
  keyboardShortcuts: {
    Backspace: ({ editor }) => {
      const { selection } = editor.prosemirrorState;
      if (
        !selection.empty ||
        selection.$from.parentOffset !== 0 ||
        selection.$from.parent.type.name !== 'callout'
      ) {
        return false;
      }

      // BlockNote's default conversion retains shared props, including the
      // callout background. Reset it when removing the callout formatting.
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: 'paragraph',
        props: { backgroundColor: defaultProps.backgroundColor.default },
      });
      return true;
    },
  },
});
