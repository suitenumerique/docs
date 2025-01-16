import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

export const useClipboard = () => {
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  const copyToClipboard = (
    text: string,
    successMessage?: string,
    errorMessage?: string,
  ) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast(successMessage ?? t('Copied to clipboard'), VariantType.SUCCESS, {
          duration: 3000,
        });
      })
      .catch(() => {
        toast(
          errorMessage ?? t('Failed to copy to clipboard'),
          VariantType.ERROR,
          {
            duration: 3000,
          },
        );
      });
  };

  return { copyToClipboard };
};
