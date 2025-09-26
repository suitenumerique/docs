import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import {
  Doc,
  base64ToYDoc,
  useProviderStore,
  useUpdateDoc,
} from '@/docs/doc-management/';

import { useDocVersion } from '../api';
import { KEY_LIST_DOC_VERSIONS } from '../api/useDocVersions';
import { Versions } from '../types';
import { revertUpdate } from '../utils';

interface ModalConfirmationVersionProps {
  onClose: () => void;
  docId: Doc['id'];

  versionId: Versions['version_id'];
}

export const ModalConfirmationVersion = ({
  onClose,
  docId,
  versionId,
}: ModalConfirmationVersionProps) => {
  const { data: version } = useDocVersion({
    docId,
    versionId,
  });
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { push } = useRouter();
  const { provider } = useProviderStore();
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_LIST_DOC_VERSIONS],
    onSuccess: () => {
      const onDisplaySuccess = () => {
        toast(t('Version restored successfully'), VariantType.SUCCESS);
        void push(`/docs/${docId}`);
      };

      if (!provider || !version?.content) {
        onDisplaySuccess();
        return;
      }

      revertUpdate(
        provider.document,
        provider.document,
        base64ToYDoc(version.content),
      );

      onDisplaySuccess();
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-describedby="modal-confirmation-version-title"
      rightActions={
        <>
          <Button
            aria-label={`${t('Cancel')} - ${t('Warning')}`}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Restore')}
            color="danger"
            fullWidth
            onClick={() => {
              if (!version?.content) {
                return;
              }

              updateDoc({
                id: docId,
                content: version.content,
              });

              onClose();
            }}
          >
            {t('Restore')}
          </Button>
        </>
      }
      size={ModalSize.SMALL}
      title={
        <Text
          as="h1"
          $margin="0"
          id="modal-confirmation-version-title"
          $size="h6"
          $align="flex-start"
          $variation="1000"
        >
          {t('Warning')}
        </Text>
      }
    >
      <Box className="--docs--modal-confirmation-version">
        <Box>
          <Text $variation="600" as="p">
            {t('Your current document will revert to this version.')}
          </Text>
          <Text $variation="600" as="p">
            {t('If a member is editing, his works can be lost.')}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};
