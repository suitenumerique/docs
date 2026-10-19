import { VariantType } from '@gouvfr-lasuite/ui-components';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from './useToast';

export const useClipboard = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    (text: string, successMessage?: string, errorMessage?: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const message =
            successMessage ??
            t('Copied to clipboard', {
              description: 'Toast after copying something to the clipboard',
            });
          toast(message, VariantType.SUCCESS, {
            duration: 3000,
          });
        })
        .catch(() => {
          const message =
            errorMessage ??
            t('Failed to copy to clipboard', {
              description: 'Toast when copying to the clipboard failed',
            });
          toast(message, VariantType.ERROR, {
            duration: 3000,
          });
        });
    },
    [t, toast],
  );
};
