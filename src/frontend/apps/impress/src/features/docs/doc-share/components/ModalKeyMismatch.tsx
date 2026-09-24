import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
} from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useKeyFingerprint } from '@/docs/doc-collaboration';
import { EncryptionModalContent } from '@/features/docs/doc-management/components/EncryptionLayout';

interface ModalKeyMismatchProps {
  onClose: () => void;
  onAcceptKey?: () => void;
  knownKey?: string;
  currentKey?: string;
}

const Fingerprint = ({ label, value }: { label: string; value: string }) => (
  <Box $gap="3xs">
    <Text $size="xs" $weight="600" $variation="secondary">
      {label}
    </Text>
    <Text
      $size="sm"
      $weight="700"
      $css="font-family: monospace; letter-spacing: 0.08em; overflow-wrap: anywhere;"
    >
      {value}
    </Text>
  </Box>
);

export const ModalKeyMismatch = ({
  onClose,
  onAcceptKey,
  knownKey,
  currentKey,
}: ModalKeyMismatchProps) => {
  const { t } = useTranslation();
  const knownFingerprint = useKeyFingerprint(knownKey);
  const currentFingerprint = useKeyFingerprint(currentKey);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.SMALL}
      aria-label={t('Verify encryption key')}
    >
      <EncryptionModalContent
        title={t('Verify encryption key')}
        description={t(
          'We recommend verifying with this person directly (for example on a call) that they really changed their encryption key before proceeding.',
        )}
        actionsLayout="row"
        actions={
          <>
            <Button variant="bordered" color="error" onClick={onClose}>
              {t("Don't trust")}
            </Button>
            {onAcceptKey && (
              <Button
                onClick={() => {
                  onAcceptKey();
                  onClose();
                }}
              >
                {t('Trust')}
              </Button>
            )}
          </>
        }
      >
        <Alert type={VariantType.WARNING}>
          {t(
            "This person's encryption key has changed. Verify it before continuing.",
          )}
        </Alert>
        {(knownFingerprint || currentFingerprint) && (
          <Box
            $gap="xs"
            $padding="xs"
            $radius="4px"
            $css="border: 1px solid var(--c--contextuals--border--surface--primary);"
          >
            {knownFingerprint && (
              <Fingerprint
                label={t('Previously known:')}
                value={knownFingerprint}
              />
            )}
            {currentFingerprint && (
              <Fingerprint
                label={t('Current key:')}
                value={currentFingerprint}
              />
            )}
          </Box>
        )}
      </EncryptionModalContent>
    </Modal>
  );
};
