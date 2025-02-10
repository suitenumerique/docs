import { combineByGroup, filterSuggestionItems } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getPageBreakReactSlashMenuItems,
  useBlockNoteEditor,
} from '@blocknote/react';
import React, { useMemo } from 'react';

import { DocsBlockNoteEditor } from '../types';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor() as DocsBlockNoteEditor;

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getPageBreakReactSlashMenuItems(editor),
          ),
          query,
        ),
      );
  }, [editor]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
