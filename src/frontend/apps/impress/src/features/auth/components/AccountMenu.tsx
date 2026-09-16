import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { useAuth } from '../hooks';
import { gotoLogout } from '../utils';

import { ModalEncryptionOnboarding } from './ModalEncryptionOnboarding';
import { ModalEncryptionSettings } from './ModalEncryptionSettings';

export const AccountMenu = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasKeys, isEnabled: isEncryptionEnabled } = useVaultClient();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // hasKeys comes from the vault — true if the user has encryption keys on this device
  const hasEncryptionSetup = hasKeys === true;

  const encryptionOption: DropdownMenuOption | null = useMemo(() => {
    if (!isEncryptionEnabled) {
      return null;
    }

    if (hasEncryptionSetup) {
      return {
        label: t('Encryption settings'),
        icon: 'lock',
        callback: () => setIsSettingsOpen(true),
        showSeparator: true,
      };
    }

    return {
      label: t('Enable encryption'),
      icon: 'lock_open',
      callback: () => setIsOnboardingOpen(true),
      showSeparator: true,
    };
  }, [isEncryptionEnabled, hasEncryptionSetup, t]);

  const options: DropdownMenuOption[] = useMemo(
    () => [
      ...(encryptionOption ? [encryptionOption] : []),
      {
        label: t('Logout'),
        icon: 'logout',
        callback: () => gotoLogout(),
      },
    ],
    [encryptionOption, t],
  );

  return (
    <>
      <DropdownMenu
        options={options}
        showArrow
        label={t('My account')}
        buttonCss={css`
          transition: all var(--c--globals--transitions--duration)
            var(--c--globals--transitions--ease-out) !important;
          border-radius: var(--c--globals--spacings--st);
          padding: 0.5rem 0.6rem;
          & > div {
            gap: 0.2rem;
            display: flex;
          }
          & .material-icons {
            color: var(
              --c--contextuals--content--palette--brand--primary
            ) !important;
          }
        `}
      >
        <Box
          $theme="brand"
          $variation="tertiary"
          $direction="row"
          $gap="0.5rem"
          $align="center"
        >
          <Icon iconName="person" $color="inherit" $size="xl" />
          {t('My account')}
        </Box>
      </DropdownMenu>
      {user && isOnboardingOpen && (
        <ModalEncryptionOnboarding
          isOpen
          onClose={() => setIsOnboardingOpen(false)}
          onSuccess={() => setIsOnboardingOpen(false)}
        />
      )}
      {user && isSettingsOpen && (
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
