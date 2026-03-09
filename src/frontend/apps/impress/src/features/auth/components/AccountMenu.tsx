import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import {
  exportPublicKeyAsBase64,
  useUserEncryption,
} from '@/docs/doc-collaboration';

import { useAuth } from '../hooks';
import { gotoLogout } from '../utils';

import { ModalEncryptionOnboarding } from './ModalEncryptionOnboarding';
import { ModalEncryptionSettings } from './ModalEncryptionSettings';

export const AccountMenu = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { encryptionSettings } = useUserEncryption();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localPublicKeyBase64, setLocalPublicKeyBase64] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (encryptionSettings?.userPublicKey) {
      exportPublicKeyAsBase64(encryptionSettings.userPublicKey).then(
        setLocalPublicKeyBase64,
      );
    } else {
      setLocalPublicKeyBase64(null);
    }
  }, [encryptionSettings]);

  const hasEncryptionSetup = !!user?.encryption_public_key;

  const hasMismatch =
    localPublicKeyBase64 !== null &&
    user?.encryption_public_key !== null &&
    localPublicKeyBase64 !== user?.encryption_public_key;

  const encryptionOption: DropdownMenuOption = useMemo(() => {
    if (hasEncryptionSetup) {
      return {
        label: t('Encryption settings'),
        icon: hasMismatch ? (
          <Icon iconName="warning" $size="20px" $theme="warning" />
        ) : (
          'lock'
        ),
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
  }, [hasEncryptionSetup, hasMismatch, t]);

  const options: DropdownMenuOption[] = useMemo(
    () => [
      encryptionOption,
      {
        label: t('Logout'),
        icon: 'logout',
        callback: gotoLogout,
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
        testId="header-account-menu"
        buttonCss={css`
          transition: all var(--c--globals--transitions--duration)
            var(--c--globals--transitions--ease-out) !important;
          border-radius: var(--c--globals--spacings--st);
          padding: 0.5rem 0.6rem;
          & > div {
            gap: 0.2rem;
            display: flex;
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
          {hasMismatch && (
            <Icon iconName="warning" $size="16px" $theme="warning" />
          )}
          {t('My account')}
        </Box>
      </DropdownMenu>

      <ModalEncryptionOnboarding
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <ModalEncryptionSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRequestReOnboard={() => {
          setIsSettingsOpen(false);
          setIsOnboardingOpen(true);
        }}
      />
    </>
  );
};
