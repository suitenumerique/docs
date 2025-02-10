import '@blocknote/mantine/style.css';
import {
  FormattingToolbar,
  FormattingToolbarController,
  FormattingToolbarProps,
  getFormattingToolbarItems,
} from '@blocknote/react';
import { AIToolbarButton } from '@blocknote/xl-ai';
import { useCallback } from 'react';

import { MarkdownButton } from './MarkdownButton';

export const BlockNoteToolbar = () => {
  const formattingToolbar = useCallback(
    ({ blockTypeSelectItems }: FormattingToolbarProps) => (
      <FormattingToolbar>
        {getFormattingToolbarItems(blockTypeSelectItems)}

        {/* Extra button to do some AI powered actions */}
        {/* <AIGroupButton key="AIButton" /> */}
        <AIToolbarButton key="AIButton" />

        {/* Extra button to convert from markdown to json */}
        <MarkdownButton key="customButton" />
      </FormattingToolbar>
    ),
    [],
  );

  return <FormattingToolbarController formattingToolbar={formattingToolbar} />;
};
