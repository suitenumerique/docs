import { Button } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { useAuth } from '../hooks';

import { ModalEncryptionOnboarding } from './ModalEncryptionOnboarding';
import { ModalEncryptionSettings } from './ModalEncryptionSettings';

/**
 * Account-level encryption entry, next to the user menu: the design system's
 * UserMenu takes no custom items, so this lives beside it. Opens the encryption
 * service's onboarding when this device holds no keys, its settings otherwise.
 */
export const EncryptionMenuButton = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasKeys, isEnabled: isEncryptionEnabled } = useVaultClient();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!user || !isEncryptionEnabled) {
    return null;
  }

  const hasEncryptionSetup = hasKeys === true;
  const label = hasEncryptionSetup
    ? t('Encryption settings')
    : t('Enable encryption');

  return (
    <>
      <Button
        aria-label={label}
        title={label}
        color="neutral"
        variant="tertiary"
        icon={
          <Icon
            iconName={hasEncryptionSetup ? 'verified_user' : 'add_moderator'}
            $color="inherit"
          />
        }
        onClick={() =>
          hasEncryptionSetup
            ? setIsSettingsOpen(true)
            : setIsOnboardingOpen(true)
        }
        className="--docs--encryption-menu-button"
      />
      {isOnboardingOpen && (
        <ModalEncryptionOnboarding
          isOpen
          onClose={() => setIsOnboardingOpen(false)}
          onSuccess={() => setIsOnboardingOpen(false)}
        />
      )}
      {isSettingsOpen && (
        <ModalEncryptionSettings
          isOpen
          onClose={() => setIsSettingsOpen(false)}
          onRequestReOnboard={() => {
            setIsSettingsOpen(false);
            setIsOnboardingOpen(true);
          }}
        />
      )}
    </>
  );
};
