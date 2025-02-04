import { combineByGroup, filterSuggestionItems } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
} from '@blocknote/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from './BlockNoteEditor';
import { insertAlert, insertDivider, insertQuote } from './custom-blocks';

export const BlockNoteSuggestionMenu = () => {
  const editor = useBlockNoteEditor() as DocsBlockNoteEditor;
  const { t } = useTranslation();

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) =>
      Promise.resolve(
        filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            [insertAlert(editor, t)],
            [insertQuote(editor, t)],
            [insertDivider(editor, t)],
          ),
          query,
        ),
      );
  }, [editor, t]);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
    />
  );
};
