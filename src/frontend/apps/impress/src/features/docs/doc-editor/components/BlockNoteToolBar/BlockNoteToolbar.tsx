import {
  FormattingToolbar,
  FormattingToolbarController,
  blockTypeSelectItems,
  getFormattingToolbarItems,
  useDictionary,
} from '@blocknote/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core/config/api';

import { AIToolbarButton } from '../AI/';
import { CommentToolbarButton } from '../comments/CommentToolbarButton';
import { getCalloutFormattingToolbarItems } from '../custom-blocks';

import { AIGroupButton } from './AIButton';
import { FileDownloadButton } from './FileDownloadButton';
import { MarkdownButton } from './MarkdownButton';
import { ModalConfirmDownloadUnsafe } from './ModalConfirmDownloadUnsafe';

export const BlockNoteToolbar = () => {
  const dict = useDictionary();
  const [confirmOpen, setIsConfirmOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<() => void | Promise<void>>();
  const { t } = useTranslation();
  const { data: conf } = useConfig();

  const toolbarItems = useMemo(() => {
    let toolbarItems = getFormattingToolbarItems([
      ...blockTypeSelectItems(dict),
      getCalloutFormattingToolbarItems(t),
    ]);

    // Find the index of the file download button
    const fileDownloadButtonIndex = toolbarItems.findIndex(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'key' in item &&
        (item as { key: string }).key === 'fileDownloadButton',
    );

    // Replace the default file download button with our custom FileDownloadButton
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

    // Remove default Comment button
    toolbarItems = toolbarItems.filter((item) => {
      if (typeof item === 'object' && item !== null && 'key' in item) {
        return item.key !== 'addCommentButton';
      }
      return true;
    });

    return toolbarItems;
  }, [dict, t]);

  const formattingToolbar = useCallback(() => {
    return (
      <FormattingToolbar>
        {conf?.AI_FEATURE_ENABLED && <AIToolbarButton />}

        <CommentToolbarButton />

        {toolbarItems}

        {/* Extra button to do some AI powered actions */}
        {conf?.AI_FEATURE_ENABLED && <AIGroupButton key="AIButton" />}

        {/* Extra button to convert from markdown to json */}
        <MarkdownButton key="customButton" />
      </FormattingToolbar>
    );
  }, [toolbarItems, conf?.AI_FEATURE_ENABLED]);

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
