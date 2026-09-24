import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { EncryptionModalContent } from '@/features/docs/doc-management/components/EncryptionLayout';

interface EncryptionHostBodyProps {
  onClose: () => void;
}

/**
 * What the product shows while the encryption interface comes up. The interface
 * draws its own modal over the page once its SDK has loaded it, so this modal
 * only carries a loader until then, or, if the SDK script itself could not be
 * loaded from the vault domain, an explanation with a retry.
 */
export const EncryptionHostBody = ({ onClose }: EncryptionHostBodyProps) => {
  const { t } = useTranslation();
  const { error } = useVaultClient();

  if (error) {
    return (
      <EncryptionModalContent
        illustration="shield-x"
        title={t('Encryption service unavailable')}
        description={t(
          'The encryption service could not be loaded. Check your connection and try again.',
        )}
        actions={
          <>
            <Button onClick={() => window.location.reload()}>
              {t('Retry')}
            </Button>
            <Button variant="bordered" color="neutral" onClick={onClose}>
              {t('Close')}
            </Button>
          </>
        }
      />
    );
  }

  return <Loading $minHeight="120px" />;
};
