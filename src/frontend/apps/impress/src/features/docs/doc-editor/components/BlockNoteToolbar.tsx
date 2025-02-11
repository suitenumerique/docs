import '@blocknote/mantine/style.css';
import {
  FormattingToolbar,
  FormattingToolbarController,
  FormattingToolbarProps,
  getFormattingToolbarItems,
} from '@blocknote/react';
import React, { useCallback } from 'react';

import { AIGroupButton } from './AIButton';
import { AIPdfButton } from './AIPdfButton';
import { MarkdownButton } from './MarkdownButton';

export const BlockNoteToolbar = () => {
  const formattingToolbar = useCallback(
    ({ blockTypeSelectItems }: FormattingToolbarProps) => {
      console.log('formattingToolbar', blockTypeSelectItems);
      return (
        <FormattingToolbar>
          {getFormattingToolbarItems(blockTypeSelectItems)}

          {/* Extra button to do some AI powered actions */}
          <AIGroupButton key="AIButton" />

          {/* Extra button to convert from markdown to json */}
          <MarkdownButton key="customButton" />

          <AIPdfButton />
        </FormattingToolbar>
      );
    },
    [],
  );

  return <FormattingToolbarController formattingToolbar={formattingToolbar} />;
};
