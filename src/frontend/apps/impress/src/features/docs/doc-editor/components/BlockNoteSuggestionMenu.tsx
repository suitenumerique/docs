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
  getQuoteReactSlashMenuItems,
  useGetInterlinkingBlockSlashMenuItems,
} from './custom-blocks';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor<DocsBlockSchema>();
  const { t } = useTranslation();
  const basicBlocksName = useDictionary().slash_menu.page_break.group;
  const getInterlinkingBlockSlashMenuItems =
    useGetInterlinkingBlockSlashMenuItems();

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getPageBreakReactSlashMenuItems(editor),
            getQuoteReactSlashMenuItems(editor, t, basicBlocksName),
            getDividerReactSlashMenuItems(editor, t, basicBlocksName),
            getInterlinkingBlockSlashMenuItems(editor, t),
          ),
          query,
        ),
      );
  }, [basicBlocksName, editor, getInterlinkingBlockSlashMenuItems, t]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
