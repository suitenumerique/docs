import { Button } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { useConfig } from '@/core/config';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { useAuth } from '../hooks';

import { ModalEncryptionSettings } from './ModalEncryptionSettings';

/**
 * Encryption entry next to the user menu, for a deployment without account
 * settings: the design system's UserMenu takes no custom items. With
 * ACCOUNT_SETTINGS_URL set, users manage their encryption there (the menu's
 * "Manage account") and Docs shows no encryption entry of its own.
 */
export const EncryptionMenuButton = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: config } = useConfig();
  const { isEnabled: isEncryptionEnabled } = useVaultClient();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!user || !isEncryptionEnabled || config?.ACCOUNT_SETTINGS_URL) {
    return null;
  }

  const label = t('Encryption settings');

  return (
    <>
      <Button
        aria-label={label}
        title={label}
        color="neutral"
        variant="tertiary"
        icon={<Icon iconName="verified_user" $color="inherit" />}
        onClick={() => setIsSettingsOpen(true)}
        className="--docs--encryption-menu-button"
      />
      {isSettingsOpen && (
        <ModalEncryptionSettings
          isOpen
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </>
  );
};
