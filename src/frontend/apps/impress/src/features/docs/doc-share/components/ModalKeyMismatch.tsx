import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { useKeyFingerprint } from '@/docs/doc-collaboration';

interface ModalKeyMismatchProps {
  onClose: () => void;
  onAcceptKey?: () => void;
  knownKey?: string;
  currentKey?: string;
}

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
      size={ModalSize.MEDIUM}
      rightActions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          {onAcceptKey && (
            <Button
              color="warning"
              onClick={() => {
                onAcceptKey();
                onClose();
              }}
            >
              {t('I trust this key')}
            </Button>
          )}
        </>
      }
      title={
        <Text
          as="h1"
          $gap="0.7rem"
          $size="h6"
          $align="flex-start"
          $direction="row"
          $margin="0"
        >
          <Icon iconName="warning" $theme="warning" />
          {t('Public key change detected')}
        </Text>
      }
    >
      <Box $direction="column" $gap="0.5rem" $margin={{ top: 'sm' }}>
        <Text $variation="secondary">
          {t(
            "This user's encryption public key has changed since you last interacted with them.",
          )}
        </Text>
        <Text $variation="secondary">
          {t(
            'This could mean the user has regenerated their encryption keys, but it could also indicate that their account has been compromised.',
          )}
        </Text>
        <Text $variation="secondary" $weight="600">
          {t(
            'We recommend verifying with this person directly (e.g. via video call) that they have indeed changed their encryption key before proceeding.',
          )}
        </Text>
        {(knownFingerprint || currentFingerprint) && (
          <Box
            $direction="column"
            $gap="0.25rem"
            $margin={{ top: 'xs' }}
            $padding="sm"
            $background="#f5f5f5"
            $border="1px solid #ddd"
            $radius="4px"
          >
            {knownFingerprint && (
              <Box $direction="row" $gap="0.5rem" $align="center">
                <Text $size="xs" $weight="600" $variation="secondary">
                  {t('Previously known:')}
                </Text>
                <Text
                  $size="xs"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                >
                  {knownFingerprint}
                </Text>
              </Box>
            )}
            {currentFingerprint && (
              <Box $direction="row" $gap="0.5rem" $align="center">
                <Text $size="xs" $weight="600" $variation="secondary">
                  {t('Current key:')}
                </Text>
                <Text
                  $size="xs"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                >
                  {currentFingerprint}
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Modal>
  );
};
