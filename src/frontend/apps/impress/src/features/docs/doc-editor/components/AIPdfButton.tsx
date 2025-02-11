import {
  useBlockNoteEditor,
  useComponentsContext,
  useSelectedBlocks,
} from '@blocknote/react';

import { Text } from '@/components';

export const AIPdfButton = () => {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const selectedBlocks = useSelectedBlocks(editor);
  if (!Components) {
    return null;
  }

  const show = selectedBlocks.length === 1 && selectedBlocks[0].type === 'file';
  if (!show) {
    return null;
  }

  return (
    <Components.FormattingToolbar.Button
      className="bn-button bn-menu-item"
      data-test="ai-actions"
      label="AI"
      mainTooltip="Chat avec le PDF"
      icon={
        <Text $isMaterialIcon $size="l">
          auto_awesome
        </Text>
      }
      onClick={() => {
        console.log('selectedBlocks', selectedBlocks);
      }}
    />
  );
};
