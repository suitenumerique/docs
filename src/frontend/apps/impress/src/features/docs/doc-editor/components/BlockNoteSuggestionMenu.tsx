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
  getCalloutReactSlashMenuItems,
  getDividerReactSlashMenuItems,
  getLatexReactSlashMenuItems,
  getMermaidReactSlashMenuItems,
  getChartReactSlashMenuItems,
} from './custom-blocks';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor<DocsBlockSchema>();
  const { t } = useTranslation();
  const basicBlocksName = useDictionary().slash_menu.page_break.group;

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getPageBreakReactSlashMenuItems(editor),
            getCalloutReactSlashMenuItems(editor, t, basicBlocksName),
            getDividerReactSlashMenuItems(editor, t, basicBlocksName),
            getLatexReactSlashMenuItems(editor, t, basicBlocksName),
            getMermaidReactSlashMenuItems(editor, t, basicBlocksName),
            getChartReactSlashMenuItems(editor, t, basicBlocksName),
          ),
          query,
        ),
      );
  }, [basicBlocksName, editor, t]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
