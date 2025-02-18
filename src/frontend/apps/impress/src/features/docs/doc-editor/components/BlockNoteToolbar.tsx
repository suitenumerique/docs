import '@blocknote/mantine/style.css';
import {
  FormattingToolbar,
  FormattingToolbarController,
  blockTypeSelectItems,
  getFormattingToolbarItems,
  useDictionary,
} from '@blocknote/react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { AIGroupButton } from './AIButton';
import { MarkdownButton } from './MarkdownButton';
import { getQuoteFormattingToolbarItems } from './custom-blocks';

export const BlockNoteToolbar = () => {
  const dict = useDictionary();
  const { t } = useTranslation();

  const formattingToolbar = useCallback(
    () => (
      <FormattingToolbar>
        {getFormattingToolbarItems([
          ...blockTypeSelectItems(dict),
          getQuoteFormattingToolbarItems(t),
        ])}

        {/* Extra button to do some AI powered actions */}
        <AIGroupButton key="AIButton" />

        {/* Extra button to convert from markdown to json */}
        <MarkdownButton key="customButton" />
      </FormattingToolbar>
    ),
    [dict, t],
  );

  return <FormattingToolbarController formattingToolbar={formattingToolbar} />;
};
