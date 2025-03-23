import { combineByGroup, filterSuggestionItems } from '@blocknote/core';
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getPageBreakReactSlashMenuItems,
  useBlockNoteEditor,
  useDictionary,
} from '@blocknote/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DocsBlockSchema } from '../types';

import {
  getDividerReactSlashMenuItems,
  getPdfSlackMenuItems,
  getQuoteReactSlashMenuItems,
} from './custom-blocks';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor<DocsBlockSchema>();
  const { t } = useTranslation();
  const dictionaryDate = useDictionary();
  const basicBlocksName = dictionaryDate.slash_menu.page_break.group;
  const fileBlocksName = dictionaryDate.slash_menu.file.group;

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getPageBreakReactSlashMenuItems(editor),
            getQuoteReactSlashMenuItems(editor, t, basicBlocksName),
            getDividerReactSlashMenuItems(editor, t, basicBlocksName),
            getPdfSlackMenuItems(editor, t, fileBlocksName),
          ),
          query,
        ),
      );
  }, [basicBlocksName, fileBlocksName, editor, t]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
