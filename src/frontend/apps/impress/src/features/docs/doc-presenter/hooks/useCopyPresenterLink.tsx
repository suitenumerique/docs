import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Doc } from '@/docs/doc-management';
import { useClipboard } from '@/hooks';

/**
 * Builds and copies a deep-link that reopens the document in presenter mode at
 * a given slide. `index` is the 0-based slide index; the URL uses a 1-based
 * `slide` param (see issue #2397).
 */
export const useCopyPresenterLink = (docId: Doc['id']) => {
  const { t } = useTranslation();
  const copyToClipboard = useClipboard();

  return useCallback(
    (index: number) => {
      copyToClipboard(
        `${window.location.origin}/docs/${docId}/?view=present&slide=${index + 1}`,
        t('Link Copied !', {
          description: 'Toast confirming a link was copied to the clipboard',
        }),
        t('Failed to copy link', {
          description: 'Toast shown when copying a link failed',
        }),
      );
    },
    [copyToClipboard, docId, t],
  );
};
