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

import { useConfig } from '@/core';

import { DocsBlockSchema } from '../types';

import { modGetAISlashMenuItems } from './AI';
import {
  getCalloutReactSlashMenuItems,
  getDividerReactSlashMenuItems,
} from './custom-blocks';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor<DocsBlockSchema>();
  const { t } = useTranslation();
  const basicBlocksName = useDictionary().slash_menu.page_break.group;
  const { data: conf } = useConfig();

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) => {
      const getAISlashMenuItems = await modGetAISlashMenuItems;

      return Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getPageBreakReactSlashMenuItems(editor),
            getCalloutReactSlashMenuItems(editor, t, basicBlocksName),
            getDividerReactSlashMenuItems(editor, t, basicBlocksName),
            conf?.AI_FEATURE_ENABLED && getAISlashMenuItems
              ? getAISlashMenuItems(editor)
              : [],
          ),
          query,
        ),
      );
    };
  }, [basicBlocksName, editor, t, conf?.AI_FEATURE_ENABLED]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
