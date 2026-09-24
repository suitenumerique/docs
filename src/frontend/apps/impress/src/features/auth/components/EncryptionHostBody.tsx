import { Button, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { EncryptionModalContent } from '@/features/docs/doc-management/components/EncryptionLayout';

/**
 * The size the interface asks for its host modal: small (350px) by default, the
 * design system's medium one when the shown screen needs the room. Resets to
 * small whenever the modal closes, so the next opening starts at the default.
 */
export const useInterfaceModalSize = (isOpen: boolean): ModalSize => {
  const { client } = useVaultClient();
  const [size, setSize] = useState<ModalSize>(ModalSize.SMALL);

  useEffect(() => {
    if (!client) {
      return;
    }

    const handleSize = ({ size: wanted }: { size: 'small' | 'medium' }) => {
      setSize(wanted === 'medium' ? ModalSize.MEDIUM : ModalSize.SMALL);
    };

    client.on('interface:size', handleSize);

    return () => {
      client.off('interface:size', handleSize);
    };
  }, [client]);

  useEffect(() => {
    if (!isOpen) {
      setSize(ModalSize.SMALL);
    }
  }, [isOpen]);

  return size;
};

interface EncryptionHostBodyProps {
  /** Receives the element the interface iframe is mounted into. */
  hostRef: (element: HTMLDivElement | null) => void;
  onClose: () => void;
}

/**
 * The body of a modal hosting the encryption interface. The interface can only
 * be opened once the SDK script has loaded from the vault domain: until then a
 * loader, and if that load failed an explanation with a retry, instead of the
 * empty host the interface would otherwise never fill.
 */
export const EncryptionHostBody = ({
  hostRef,
  onClose,
}: EncryptionHostBodyProps) => {
  const { t } = useTranslation();
  const { client, isLoading, error } = useVaultClient();

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

  if (!client || isLoading) {
    return <Loading $minHeight="120px" />;
  }

  return (
    <div
      ref={hostRef}
      className="--docs--encryption-host"
      style={{ minHeight: '120px' }}
    />
  );
};
