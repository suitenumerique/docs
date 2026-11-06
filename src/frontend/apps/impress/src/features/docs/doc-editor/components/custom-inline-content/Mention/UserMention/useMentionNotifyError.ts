import { VariantType, useToastProvider } from '@gouvfr-lasuite/ui-components';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Warns the user that a person they mentioned, in the doc or in a comment,
 * could not be notified. The mention itself is kept.
 */
export const useMentionNotifyError = () => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();

  return useCallback(() => {
    toast(
      t('The person could not be notified of the mention.', {
        description:
          'Error message shown when the email notifying a mentioned user could not be sent',
      }),
      VariantType.ERROR,
    );
  }, [t, toast]);
};
