import { useCallback } from 'react';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

export const useFocusMainContent = () => {
  return useCallback(() => {
    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    if (!mainContent) {
      return;
    }

    mainContent.focus();
    mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
};
