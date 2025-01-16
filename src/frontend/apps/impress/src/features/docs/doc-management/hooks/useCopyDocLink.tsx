import { useTranslation } from 'react-i18next';

import { useClipboard } from '@/hook';

import { Doc } from '../types';

export const useCopyDocLink = (doc: Doc) => {
  const { t } = useTranslation();
  const { copyToClipboard } = useClipboard();

  const copyDocLink = () => {
    copyToClipboard(
      `${window.location.origin}/docs/${doc.id}/`,
      t('Link Copied !'),
      t('Failed to copy link'),
    );
  };
  return { copyDocLink };
};
