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

import { useRemoveDoc } from '../api/useRemoveDoc';
import { Doc } from '../types';

interface ModalRemoveDocProps {
  onClose: () => void;
  doc: Doc;
  afterDelete?: (doc: Doc) => void;
}

export const ModalRemoveDoc = ({
  onClose,
  doc,
  afterDelete,
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
      toast(t('The document has been deleted.'), VariantType.SUCCESS, {
        duration: 4000,
      });
      if (afterDelete) {
        afterDelete(doc);
        return;
      }

      if (pathname === '/') {
        onClose();
      } else {
        void push('/');
      }
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      rightActions={
        <>
          <Button
            aria-label={t('Close the modal')}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Confirm deletion')}
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
        <Text
          $size="h6"
          as="h6"
          $margin={{ all: '0' }}
          $align="flex-start"
          $variation="1000"
        >
          {t('Delete a doc')}
        </Text>
      }
    >
      <Box
        aria-label={t('Content modal to delete document')}
        className="--docs--modal-remove-doc"
      >
        {!isError && (
          <Text $size="sm" $variation="600" $display="inline-block">
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
