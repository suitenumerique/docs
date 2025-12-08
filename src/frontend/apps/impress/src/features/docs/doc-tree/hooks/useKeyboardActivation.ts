import { useEffect } from 'react';

export const useKeyboardActivation = (
  keys: string[],
  enabled: boolean,
  action: () => void,
  capture = false,
  selector: string,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) {
        return;
      }

      // Limit activation to doc tree rows that actually contain a DocSubPageItem
      const row = target.closest('.c__tree-view--row');
      if (!row || !row.querySelector('.--docs-sub-page-item')) {
        return;
      }

      // Do not hijack Enter/Space when focus is on emoji button or actions toolbar:
      // in these cases we want the native button / dropdown behavior.
      if (
        target.closest('.--docs--doc-icon') ||
        target.closest('.light-doc-item-actions')
      ) {
        return;
      }

      if (!keys.includes(e.key)) {
        return;
      }

      e.preventDefault();
      action();
    };

    const treeEl = document.querySelector<HTMLElement>(selector);
    if (!treeEl) {
      return;
    }

    treeEl.addEventListener('keydown', onKeyDown, capture);

    return () => {
      treeEl.removeEventListener('keydown', onKeyDown, capture);
    };
  }, [keys, enabled, action, capture, selector]);
};
