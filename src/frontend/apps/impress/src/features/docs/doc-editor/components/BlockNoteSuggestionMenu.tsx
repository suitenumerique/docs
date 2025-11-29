import { combineByGroup, filterSuggestionItems } from '@blocknote/core';
import {
  DefaultReactSuggestionItem,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getPageBreakReactSlashMenuItems,
  useBlockNoteEditor,
  useDictionary,
} from '@blocknote/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../types';

import {
  getCalloutReactSlashMenuItems,
  getPdfReactSlashMenuItems,
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
  const dictionaryDate = useDictionary();
  const basicBlocksName = dictionaryDate.slash_menu.page_break.group;
  const fileBlocksName = dictionaryDate.slash_menu.file.group;

  const getInterlinkingMenuItems = useGetInterlinkingMenuItems();

  const getSlashMenuItems = useMemo(() => {
    // We insert it after the "Code Block" item to have the interlinking block displayed after the basic blocks
    const defaultMenu = getDefaultReactSlashMenuItems(editor);

    const combinedMenu = combineByGroup(
      defaultMenu,
      getPageBreakReactSlashMenuItems(editor),
      getMultiColumnSlashMenuItems?.(editor) || [],
      getPdfReactSlashMenuItems(editor, t, fileBlocksName),
      getCalloutReactSlashMenuItems(editor, t, basicBlocksName),
    );

    const index = combinedMenu.findIndex(
      (item) =>
        (item as DefaultReactSuggestionItem & { key: string })?.key ===
        'callout',
    );

    const newSlashMenuItems = [
      ...combinedMenu.slice(0, index + 1),
      ...getInterlinkingMenuItems(editor, t),
      ...combinedMenu.slice(index + 1),
    ];

    return async (query: string) =>
      Promise.resolve(filterSuggestionItems(newSlashMenuItems, query));
  }, [basicBlocksName, editor, getInterlinkingMenuItems, t, fileBlocksName]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
