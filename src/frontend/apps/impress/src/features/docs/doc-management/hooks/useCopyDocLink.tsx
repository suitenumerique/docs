import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useClipboard } from '@/hook';

import { Doc } from '../types';

export const useCopyDocLink = (docId: Doc['id']) => {
  const { t } = useTranslation();
  const copyToClipboard = useClipboard();

  return useCallback(() => {
    copyToClipboard(
      `${window.location.origin}/docs/${docId}/`,
      t('Link Copied !'),
      t('Failed to copy link'),
    );
  }, [copyToClipboard, docId, t]);
};
