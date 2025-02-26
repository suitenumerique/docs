import '@blocknote/mantine/style.css';
import {
  FormattingToolbar,
  FormattingToolbarController,
  blockTypeSelectItems,
  getFormattingToolbarItems,
  useDictionary,
} from '@blocknote/react';
import React, { useCallback, useState } from 'react';

import { AIGroupButton } from './AIButton';
import { FileDownloadButton } from './FileDownloadButton';
import { MarkdownButton } from './MarkdownButton';
import { ModalConfirmDownloadUnsafe } from './ModalConfirmDownloadUnsafe';

export const BlockNoteToolbar = () => {
  const dict = useDictionary();
  const [confirmOpen, setIsConfirmOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<() => void | Promise<void>>();

  const formattingToolbar = useCallback(() => {
    //console.log('dict', getFormattingToolbarItems(blockTypeSelectItems(dict)));

    return (
      <FormattingToolbar>
        {getFormattingToolbarItems(blockTypeSelectItems(dict))}

        {/* Extra button to do some AI powered actions */}
        <AIGroupButton key="AIButton" />
        <FileDownloadButton
          key="FileDownloadButton2"
          open={(onConfirm) => {
            console.log('onConfirm');
            setIsConfirmOpen(true);
            setOnConfirm(() => onConfirm);
          }}
        />

        {/* Extra button to convert from markdown to json */}
        <MarkdownButton key="customButton" />
      </FormattingToolbar>
    );
  }, [dict]);

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
