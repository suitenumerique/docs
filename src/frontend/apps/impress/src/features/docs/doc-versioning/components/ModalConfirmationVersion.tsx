import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import {
  Doc,
  base64ToYDoc,
  useProviderStore,
  useUpdateDoc,
} from '@/docs/doc-management/';
import { useFocusOnMount } from '@/hooks';

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
  const cancelButtonRef = useRef<ButtonElement>(null);
  const { data: version } = useDocVersion({
    docId,
    versionId,
  });
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { push } = useRouter();
  const { provider } = useProviderStore();
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalidQueries: [KEY_LIST_DOC_VERSIONS],
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

  useFocusOnMount(cancelButtonRef);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-describedby="modal-confirmation-version-title"
      rightActions={
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={`${t('Cancel')} - ${t('Warning')}`}
            variant="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Restore')}
            color="error"
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
        >
          {t('Warning')}
        </Text>
      }
    >
      <Box className="--docs--modal-confirmation-version">
        <Box>
          <Text $variation="secondary" as="p">
            {t('Your current document will revert to this version.')}
          </Text>
          <Text $variation="secondary" as="p">
            {t('If a member is editing, his works can be lost.')}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};
