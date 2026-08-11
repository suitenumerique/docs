import { FormattingToolbarExtension } from '@blocknote/core/extensions';
import { useCallback, useEffect, useState } from 'react';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

export const useFindReplace = (editor: DocsBlockNoteEditor | undefined) => {
  const [query, setQueryState] = useState('');
  const [replacement, setReplacementState] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const tiptapEditor = editor?._tiptapEditor;

  const syncFromStorage = useCallback(() => {
    if (!tiptapEditor) {
      return;
    }

    const { results, currentIndex } = tiptapEditor.storage.findAndReplace;
    setMatchCount(results.length);
    setActiveIndex(currentIndex ?? -1);
  }, [tiptapEditor]);

  // The extension only calls ProseMirror's tr.scrollIntoView(), which doesn't
  // reliably reach the active match through BlockNote's scroll container, so
  // we scroll to it manually instead.
  const scrollActiveIntoView = useCallback(() => {
    if (!tiptapEditor) {
      return;
    }

    const { results, currentIndex } = tiptapEditor.storage.findAndReplace;
    const match = currentIndex !== null ? results[currentIndex] : undefined;
    if (!match) {
      return;
    }

    const { view } = tiptapEditor;
    const domInfo = view.domAtPos(match.from);
    const el =
      domInfo.node.nodeType === 1
        ? (domInfo.node as HTMLElement)
        : domInfo.node.parentElement;

    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [tiptapEditor]);

  // Navigating/replacing matches moves the real editor selection, which
  // triggers BlockNote's formatting toolbar. Force it closed since it isn't
  // relevant while using find & replace.
  const hideFormattingToolbar = useCallback(() => {
    editor?.getExtension(FormattingToolbarExtension)?.store.setState(false);
  }, [editor]);

  // Reset the extension's state when the panel opens and subscribe to
  // transactions to keep match count/active index in sync while it's open.
  useEffect(() => {
    if (!tiptapEditor) {
      return;
    }

    tiptapEditor?.commands.clearSearch();
    tiptapEditor?.commands.setReplaceTerm('');
    syncFromStorage();

    tiptapEditor.on('transaction', syncFromStorage);

    return () => {
      tiptapEditor.off('transaction', syncFromStorage);
      tiptapEditor?.commands.clearSearch();
    };
  }, [tiptapEditor, syncFromStorage]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      tiptapEditor?.commands.setSearchTerm(value);
      requestAnimationFrame(scrollActiveIntoView);
    },
    [tiptapEditor, scrollActiveIntoView],
  );

  const setReplacement = useCallback(
    (value: string) => {
      setReplacementState(value);
      tiptapEditor?.commands.setReplaceTerm(value);
    },
    [tiptapEditor],
  );

  const goToNext = useCallback(() => {
    tiptapEditor?.commands.goToNextResult();
    hideFormattingToolbar();
    scrollActiveIntoView();
  }, [tiptapEditor, scrollActiveIntoView, hideFormattingToolbar]);

  const goToPrevious = useCallback(() => {
    tiptapEditor?.commands.goToPreviousResult();
    hideFormattingToolbar();
    scrollActiveIntoView();
  }, [tiptapEditor, scrollActiveIntoView, hideFormattingToolbar]);

  const replaceCurrent = useCallback(() => {
    tiptapEditor?.commands.replace();
    hideFormattingToolbar();
    requestAnimationFrame(scrollActiveIntoView);
  }, [tiptapEditor, scrollActiveIntoView, hideFormattingToolbar]);

  const replaceAll = useCallback(() => {
    tiptapEditor?.commands.replaceAll();
  }, [tiptapEditor]);

  return {
    query,
    setQuery,
    replacement,
    setReplacement,
    matchCount,
    activeIndex,
    goToNext,
    goToPrevious,
    replaceCurrent,
    replaceAll,
  };
};
