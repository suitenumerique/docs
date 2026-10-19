import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useClipboard } from '@/hooks';

import { Doc } from '../types';

export const useCopyDocLink = (docId: Doc['id']) => {
  const { t } = useTranslation();
  const copyToClipboard = useClipboard();

  return useCallback(() => {
    copyToClipboard(
      `${window.location.origin}/docs/${docId}/`,
      t('Link Copied !', {
        description: 'Toast confirming a link was copied to the clipboard',
      }),
      t('Failed to copy link', {
        description: 'Toast shown when copying a link failed',
      }),
    );
  }, [copyToClipboard, docId, t]);
};
