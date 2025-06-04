import { Button, Input, Modal, ModalSize } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
export const GristApiKeyModal = ({
  isOpen,
  setOpen,
  gristApiKey,
  setGristApiKey,
}: {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  gristApiKey: string | null;
  setGristApiKey: (key: string) => void;
}) => {
  const { t: translation } = useTranslation();

  const validateGristApiKey = (): void => {
    if (gristApiKey !== null) {
      localStorage.setItem('grist_api_key', gristApiKey);
    }
    setOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      closeOnClickOutside
      data-testid="doc-share-modal"
      aria-label={translation('Configure Grist API Key')}
      size={ModalSize.SMALL}
      onClose={() => setOpen(false)}
      title={<Box $align="flex-start">{translation('Grist API Key')}</Box>}
    >
      <Box>
        <Text style={{ marginBottom: '16px' }}>
          {translation(
            'To sync your data with Grist, you need to provide an API Key',
          )}
        </Text>
        <Text style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          {translation('How to find you API Key')}:
        </Text>
        <Text>1. {translation('Connect to your Grist account')}</Text>
        <Text>2. {translation('Go to Profile settings > API > API Key')}</Text>
        <Text style={{ marginBottom: '16px' }}>
          3. {translation('Create a new API Key and copy it')}
        </Text>
        <Input
          label={translation('Grist API Key')}
          onChange={(event) => {
            const value = event.target.value;
            setGristApiKey(value);
          }}
        />
        <Button
          onClick={validateGristApiKey}
          style={{ alignSelf: 'end', width: 'fit-content', marginTop: '16px' }}
        >
          {translation('Validate API Key')}
        </Button>
      </Box>
    </Modal>
  );
};
