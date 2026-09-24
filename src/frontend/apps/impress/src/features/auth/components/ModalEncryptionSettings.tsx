/**
 * Encryption settings modal — delegates to the centralized encryption service.
 *
 * Opens the encryption service's settings interface iframe which handles:
 * fingerprint display, key deletion, device transfer export, and server key management.
 */
import { Modal } from '@gouvfr-lasuite/cunningham-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import {
  EncryptionHostBody,
  useInterfaceModalSize,
} from './EncryptionHostBody';

interface ModalEncryptionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestReOnboard: () => void;
}

export const ModalEncryptionSettings = ({
  isOpen,
  onClose,
}: ModalEncryptionSettingsProps) => {
  const { t } = useTranslation();
  const { client: vaultClient, refreshKeyState } = useVaultClient();
  const { refreshEncryption } = useUserEncryption();
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [settingsOpened, setSettingsOpened] = useState(false);

  // Open the vault's settings interface when container is mounted
  useEffect(() => {
    if (!isOpen || !vaultClient || !containerEl || settingsOpened) {
      return;
    }

    setSettingsOpened(true);
    vaultClient.openSettings(containerEl);
  }, [isOpen, vaultClient, containerEl, settingsOpened]);

  // Listen for interface close and key changes
  useEffect(() => {
    if (!vaultClient) {
      return;
    }

    const handleClosed = () => {
      setSettingsOpened(false);
      void refreshKeyState().then(() => refreshEncryption());
      onClose();
    };

    const handleKeysDestroyed = () => {
      void refreshKeyState().then(() => refreshEncryption());
    };

    vaultClient.on('interface:closed', handleClosed);
    vaultClient.on('keys-destroyed', handleKeysDestroyed);

    return () => {
      vaultClient.off('interface:closed', handleClosed);
      vaultClient.off('keys-destroyed', handleKeysDestroyed);
    };
  }, [vaultClient, refreshKeyState, refreshEncryption, onClose]);

  // The modal's close control only ASKS the interface to close: it may hold an
  // unsaved recovery phrase and answer with its own confirmation. The modal goes
  // away on 'interface:closed', which the interface emits once really done.
  const handleClose = useCallback(() => {
    if (vaultClient) {
      vaultClient.requestClose();
    } else {
      onClose();
    }
  }, [vaultClient, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSettingsOpened(false);
    }
  }, [isOpen]);

  const size = useInterfaceModalSize(isOpen);

  return (
    <Modal
      isOpen={isOpen}
      closeOnClickOutside={false}
      onClose={handleClose}
      size={size}
      aria-label={t('Encryption')}
    >
      <EncryptionHostBody hostRef={setContainerEl} onClose={onClose} />
    </Modal>
  );
};
