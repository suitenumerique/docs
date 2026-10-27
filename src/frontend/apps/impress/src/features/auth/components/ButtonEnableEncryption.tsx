import { Button } from '@gouvfr-lasuite/ui-components';
import { ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { ModalEncryptionOnboarding } from './ModalEncryptionOnboarding';

type ButtonEnableEncryptionProps = Pick<
  ComponentProps<typeof Button>,
  'size' | 'fullWidth' | 'icon'
> & {
  /** Called once the onboarding registered the user's keys and the state was refreshed. */
  onEnabled?: () => void;
};

/**
 * Starts the encryption onboarding from wherever a user without keys is stopped,
 * so they continue where they were once it is done. The loader modal stays
 * mounted until the interface closes, even after the onboarding completed.
 */
export const ButtonEnableEncryption = ({
  onEnabled,
  ...buttonProps
}: ButtonEnableEncryptionProps) => {
  const { t } = useTranslation();
  const { isEnabled } = useVaultClient();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <Button
        {...buttonProps}
        onClick={() => setIsOnboardingOpen(true)}
        className="--docs--button-enable-encryption"
      >
        {t('Enable encryption')}
      </Button>
      {isOnboardingOpen && (
        <ModalEncryptionOnboarding
          isOpen
          onClose={() => setIsOnboardingOpen(false)}
          onSuccess={onEnabled}
        />
      )}
    </>
  );
};
