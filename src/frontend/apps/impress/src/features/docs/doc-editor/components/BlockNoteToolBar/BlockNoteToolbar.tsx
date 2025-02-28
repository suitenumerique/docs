import '@blocknote/mantine/style.css';
import {
  FormattingToolbar,
  FormattingToolbarController,
  blockTypeSelectItems,
  getFormattingToolbarItems,
  useDictionary,
} from '@blocknote/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getQuoteFormattingToolbarItems } from '../custom-blocks';

import { AIGroupButton } from './AIButton';
import { FileDownloadButton } from './FileDownloadButton';
import { MarkdownButton } from './MarkdownButton';
import { ModalConfirmDownloadUnsafe } from './ModalConfirmDownloadUnsafe';

export const BlockNoteToolbar = () => {
  const dict = useDictionary();
  const [confirmOpen, setIsConfirmOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<() => void | Promise<void>>();
  const { t } = useTranslation();

  const toolbarItems = useMemo(() => {
    const toolbarItems = getFormattingToolbarItems([
      ...blockTypeSelectItems(dict),
      getQuoteFormattingToolbarItems(t),
    ]);
    const fileDownloadButtonIndex = toolbarItems.findIndex(
      (item) => item.key === 'fileDownloadButton',
    );
    if (fileDownloadButtonIndex !== -1) {
      toolbarItems.splice(
        fileDownloadButtonIndex,
        1,
        <FileDownloadButton
          key="fileDownloadButton"
          open={(onConfirm) => {
            setIsConfirmOpen(true);
            setOnConfirm(() => onConfirm);
          }}
        />,
      );
    }

    return toolbarItems;
  }, [dict, t]);

  const formattingToolbar = useCallback(() => {
    return (
      <FormattingToolbar>
        {toolbarItems}

        {/* Extra button to do some AI powered actions */}
        <AIGroupButton key="AIButton" />

        {/* Extra button to convert from markdown to json */}
        <MarkdownButton key="customButton" />
      </FormattingToolbar>
    );
  }, [toolbarItems]);

  return (
    <>
      <FormattingToolbarController formattingToolbar={formattingToolbar} />
      {confirmOpen && (
        <ModalConfirmDownloadUnsafe
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={onConfirm}
        />
      )}
    </>
  );
};
