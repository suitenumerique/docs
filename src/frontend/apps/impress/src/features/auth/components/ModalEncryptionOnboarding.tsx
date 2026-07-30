/**
 * Encryption onboarding modal — delegates to the centralized encryption service.
 *
 * Opens the encryption service's interface iframe which handles everything:
 * key generation, backup, restore, device transfer, and server registration.
 * The product (Docs) doesn't manage public keys — it only stores fingerprints
 * on document accesses for UI purposes.
 */
import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Box } from '@/components';
import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

interface ModalEncryptionOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalEncryptionOnboarding = ({
  isOpen,
  onClose,
  onSuccess,
}: ModalEncryptionOnboardingProps) => {
  const { client: vaultClient, refreshKeyState } = useVaultClient();
  const { refreshEncryption } = useUserEncryption();
  const onboardingOpenedRef = useRef(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      !isOpen ||
      !vaultClient ||
      !containerEl ||
      onboardingOpenedRef.current
    ) {
      return;
    }

    onboardingOpenedRef.current = true;
    vaultClient.openOnboarding(containerEl);
  }, [isOpen, vaultClient, containerEl]);

  useEffect(() => {
    if (!vaultClient) {
      return;
    }

    const handleComplete = async () => {
      // The encryption service registered the public key on its central server.
      // Docs doesn't need to store it — just refresh the vault key state.
      await refreshKeyState();
      refreshEncryption();
      onSuccess?.();
    };

    const handleClosed = () => {
      onboardingOpenedRef.current = false;
      onClose();
    };

    vaultClient.on('onboarding:complete', handleComplete);
    vaultClient.on('interface:closed', handleClosed);

    return () => {
      vaultClient.off('onboarding:complete', handleComplete);
      vaultClient.off('interface:closed', handleClosed);
    };
  }, [vaultClient, refreshKeyState, refreshEncryption, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    vaultClient?.closeInterface();
    onboardingOpenedRef.current = false;
    onClose();
  }, [vaultClient, onClose]);

  useEffect(() => {
    if (!isOpen) {
      onboardingOpenedRef.current = false;
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      closeOnClickOutside={false}
      onClose={handleClose}
      size={ModalSize.LARGE}
      hideCloseButton
    >
      <Box $minHeight="400px">
        <div
          ref={setContainerEl}
          style={{ width: '100%', minHeight: '400px' }}
        />
      </Box>
    </Modal>
  );
};
