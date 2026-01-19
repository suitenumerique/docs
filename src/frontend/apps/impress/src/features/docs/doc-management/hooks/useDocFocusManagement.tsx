import { useEffect } from 'react';

import { cssSelectors } from '@/docs/doc-management/utils';

const isWithin = (el: Element | null, selector: string) =>
  !!el?.closest(selector);

export const useDocFocusManagement = (docId?: string, isReady = true) => {
  // 1) Auto-focus title when opening a doc
  useEffect(() => {
    if (!docId || !isReady || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const titleElement = document.querySelector<HTMLElement>(
        cssSelectors.DOC_TITLE,
      );
      if (!titleElement) {
        return;
      }

      // Avoid stealing focus if user is already in the doc tree or editor.
      const activeEl = document.activeElement;
      const active = activeEl instanceof Element ? activeEl : null;
      const isInDocUI =
        isWithin(active, cssSelectors.DOC_EDITOR_FOCUS) ||
        isWithin(active, cssSelectors.DOC_TREE);

      const isBodyFocused = activeEl === document.body;

      if (isBodyFocused && !isInDocUI && activeEl !== titleElement) {
        titleElement.focus();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [docId, isReady]);

  // 2) Escape from editor/title -> focus back the selected tree item (or root)
  useEffect(() => {
    if (!docId || !isReady || typeof window === 'undefined') {
      return;
    }

    const handleFocusShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'F6' || event.defaultPrevented) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const activeEl = document.activeElement;
      const active = activeEl instanceof Element ? activeEl : null;

      const isDocFocus =
        isWithin(target, cssSelectors.DOC_EDITOR_FOCUS) ||
        isWithin(active, cssSelectors.DOC_EDITOR_FOCUS) ||
        isWithin(target, cssSelectors.DOC_TITLE) ||
        isWithin(active, cssSelectors.DOC_TITLE);

      if (!isDocFocus) {
        return;
      }

      const docTree = document.querySelector<HTMLElement>(
        cssSelectors.DOC_TREE,
      );

      const docTreeItem =
        docTree?.querySelector<HTMLElement>(
          cssSelectors.DOC_TREE_SELECTED_ROW,
        ) ||
        docTree?.querySelector<HTMLElement>(
          cssSelectors.DOC_TREE_SELECTED_NODE,
        ) ||
        document.querySelector<HTMLElement>(cssSelectors.DOC_TREE_ROOT);

      if (!docTreeItem) {
        return;
      }

      docTreeItem.focus();
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('keydown', handleFocusShortcut, true);
    return () =>
      document.removeEventListener('keydown', handleFocusShortcut, true);
  }, [docId, isReady]);
};
