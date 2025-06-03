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
      title={<Box $align="flex-start">{translation('Base de données')}</Box>}
    >
      <Box>
        <Text>
          Pour synchroniser vos données avec Grist vous devez fournir une clé
          API.
        </Text>
        <Text style={{ fontWeight: 'bold' }}>
          Comment obtenir votre clé API :
        </Text>
        <Text>1. Connectez-vous à votre compte Grist</Text>
        <Text>
          2. Allez dans Paramètres du compte {'>'} API {'>'} Clé API
        </Text>
        <Text>3. Créez une nouvelle clé et copiez-la</Text>
      </Box>
      <Input
        label="Grist API key"
        onChange={(event) => {
          const value = event.target.value;
          setGristApiKey(value);
        }}
      />
      <Button onClick={validateGristApiKey}>
        {translation('Valider la clé API')}
      </Button>
    </Modal>
  );
};
