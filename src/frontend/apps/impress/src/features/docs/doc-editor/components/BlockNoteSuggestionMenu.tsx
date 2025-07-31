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

import { useHeadingAccessibilityFilter } from '../hook';
import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../types';

import {
  getCalloutReactSlashMenuItems,
  getDividerReactSlashMenuItems,
} from './custom-blocks';
import { useGetInterlinkingMenuItems } from './custom-inline-content';
import XLMultiColumn from './xl-multi-column';

const getMultiColumnSlashMenuItems =
  XLMultiColumn?.getMultiColumnSlashMenuItems;

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const { t } = useTranslation();
  const basicBlocksName = useDictionary().slash_menu.page_break.group;
  const getInterlinkingMenuItems = useGetInterlinkingMenuItems();
  const { filterHeadingItemsByAccessibility } = useHeadingAccessibilityFilter();

  const getSlashMenuItems = useMemo(() => {
    // We insert it after the "Code Block" item to have the interlinking block displayed after the basic blocks
    const defaultMenu = getDefaultReactSlashMenuItems(editor);
    const index = defaultMenu.findIndex(
      (item) => item.aliases?.includes('code') && item.aliases?.includes('pre'),
    );
    const newSlashMenuItems = [
      ...defaultMenu.slice(0, index + 1),
      ...getInterlinkingMenuItems(editor, t),
      ...defaultMenu.slice(index + 1),
    ];

    const filteredMenuItems = filterHeadingItemsByAccessibility(
      newSlashMenuItems,
      editor,
    );

    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            filteredMenuItems,
            getCalloutReactSlashMenuItems(editor, t, basicBlocksName),
            getMultiColumnSlashMenuItems?.(editor) || [],
            getPageBreakReactSlashMenuItems(editor),
            getDividerReactSlashMenuItems(editor, t, basicBlocksName),
          ),
          query,
        ),
      );
  }, [
    basicBlocksName,
    editor,
    getInterlinkingMenuItems,
    t,
    filterHeadingItemsByAccessibility,
  ]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
