import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/router';
import { Trans, useTranslation } from 'react-i18next';

import { Box, Text, TextErrors } from '@/components';
import ButtonCloseModal from '@/components/modal/ButtonCloseModal';

import { useRemoveDoc } from '../api/useRemoveDoc';
import { Doc } from '../types';

interface ModalRemoveDocProps {
  doc: Doc;
  onClose: () => void;
  onSuccess?: (doc: Doc) => void;
}

export const ModalRemoveDoc = ({
  doc,
  onClose,
  onSuccess,
}: ModalRemoveDocProps) => {
  const { toast } = useToastProvider();
  const { t } = useTranslation();
  const { push } = useRouter();
  const pathname = usePathname();
  const {
    mutate: removeDoc,
    isError,
    error,
  } = useRemoveDoc({
    onSuccess: () => {
      if (onSuccess) {
        onSuccess(doc);
      } else if (pathname === '/') {
        onClose();
      } else {
        void push('/');
      }

      toast(t('The document has been deleted.'), VariantType.SUCCESS, {
        duration: 4000,
      });
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={() => onClose()}
      aria-describedby="modal-remove-doc-title"
      rightActions={
        <>
          <Button
            aria-label={t('Cancel the deletion')}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Delete document')}
            color="danger"
            fullWidth
            onClick={() =>
              removeDoc({
                docId: doc.id,
              })
            }
          >
            {t('Delete')}
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
            id="modal-remove-doc-title"
            $margin="0"
            $align="flex-start"
            $variation="1000"
          >
            {t('Delete a doc')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the delete modal')}
            onClick={() => onClose()}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-remove-doc">
        {!isError && (
          <Text $size="sm" $variation="600" $display="inline-block" as="p">
            <Trans t={t}>
              This document and <strong>any sub-documents</strong> will be
              permanently deleted. This action is irreversible.
            </Trans>
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
