import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { openDB } from 'idb';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import {
  encryptContent,
  generateSymmetricKey,
  generateUserKeyPair,
  prepareEncryptedSymmetricKeysForUsers,
} from '@/docs/doc-collaboration';
import { useAuth } from '@/features/auth';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useEncryptDoc,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useKeyboardAction } from '@/hooks';

interface ModalEncryptDocProps {
  doc: Doc;
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null;
  onClose: () => void;
  onSuccess?: (doc: Doc) => void;
}

export const ModalEncryptDoc = ({
  doc,
  encryptionSettings,
  onClose,
  onSuccess,
}: ModalEncryptDocProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider } = useProviderStore();
  const { user } = useAuth();

  const {
    mutate: encryptDoc,
    isError,
    error,
  } = useEncryptDoc({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
    options: {
      onSuccess: () => {
        onSuccess && onSuccess(doc);
        onClose();

        toast(t('The document has been encrypted.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
    },
  });

  const keyboardAction = useKeyboardAction();

  const handleClose = () => {
    onClose();
  };

  const handleEncrypt = async () => {
    if (!provider || !user) {
      return;
    }

    // Perform the onboarding if that's the first time using encryption on this device
    if (!encryptionSettings) {
      // TODO: trigger the onboarding, either by creating or retrieving a key from another device
      // TODO: probably the logic should be at a device key level, not user one?

      const userKeyPair = await generateUserKeyPair();

      const encryptionDatabase = await openDB('encryption');

      // TODO: it should use transaction
      // encryptionDatabase.transaction
      await encryptionDatabase.put(
        'privateKey',
        userKeyPair.privateKey,
        `user:${user.id}`,
      );
      await encryptionDatabase.put(
        'publicKey',
        userKeyPair.publicKey,
        `user:${user.id}`,
      );

      // TODO:
      // TODO: it should call an endpoint to update the user
      // TODO:

      // TODO: should check encryptionSettings will update, otherwise hard refresh is needed
      window.location.reload();

      return;
    }

    const documentSymmetricKey = await generateSymmetricKey();

    const state = Y.encodeStateAsUpdate(provider.document);
    const encryptedContent = await encryptContent(
      new Uint8Array(state),
      documentSymmetricKey,
    );

    // Their public key are base64 encoded, decoding the whole
    const usersPublicKeys: Record<string, ArrayBuffer> = {};

    if (doc.accesses_public_keys_per_user) {
      // TODO:
      // TODO: should throw if missing public keys according to current accesses
      // TODO:

      for (const [userId, publicKey] of Object.entries(
        doc.accesses_public_keys_per_user,
      )) {
        usersPublicKeys[userId] = Buffer.from(publicKey, 'base64').buffer;
      }
    } else {
      // if it has been not provided it's weird because it should only happen for people not authenticated
      throw new Error(`"accesses_public_keys_per_user" should be provided`);
    }

    // Prepare encrypted symmetric keys for all users with access
    const encryptedSymmetricKeyPerUser =
      await prepareEncryptedSymmetricKeysForUsers(
        documentSymmetricKey,
        usersPublicKeys,
      );

    // TODO:
    // TODO: if none it should at least make it for the current user
    // TODO: so it makes sense `accesses_public_keys_per_user` is always passed?
    // TODO:

    encryptDoc({
      docId: doc.id,
      content: encryptedContent,
      encryptedSymmetricKeyPerUser,
    });
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleEncryptKeyDown = keyboardAction(handleEncrypt);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-encrypt-doc-title"
      rightActions={
        <>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="error"
            fullWidth
            onClick={handleEncrypt}
            onKeyDown={handleEncryptKeyDown}
          >
            {t('Confirm')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $width="100%"
        >
          <Text
            $size="h6"
            as="h1"
            id="modal-encrypt-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Encrypt document')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the encrypt modal')}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-encrypt-doc">
        {!isError && (
          <Text
            $size="sm"
            $variation="secondary"
            $display="inline-block"
            as="p"
          >
            <br />
            TODO: warning about encryption
            <br />
            TODO: accesses for users without public key will be lost (list them)
            <br />
            TODO: if no public key for current user, provide an onboarding
            <br />
            TODO: if document public, tell it needs first to be private (add
            backend check too)
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
