import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const useClipboard = () => {
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return useCallback(
    (text: string, successMessage?: string, errorMessage?: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const message = successMessage ?? t('Copied to clipboard');
          toast(message, VariantType.SUCCESS, {
            duration: 3000,
          });
        })
        .catch(() => {
          const message = errorMessage ?? t('Failed to copy to clipboard');
          toast(message, VariantType.ERROR, {
            duration: 3000,
          });
        });
    },
    [t, toast],
  );
};
