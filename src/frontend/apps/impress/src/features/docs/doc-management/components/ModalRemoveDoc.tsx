import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { useConfig } from '@/core';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid';
import { useKeyboardAction } from '@/hooks';

import { KEY_LIST_DOC } from '../api/useDocs';
import { useRemoveDoc } from '../api/useRemoveDoc';
import { useDocUtils } from '../hooks';
import { Doc } from '../types';

const CANCEL_BUTTON_ID = 'modal-remove-doc-cancel-button';

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
  const { data: config } = useConfig();
  const trashBinCutoffDays = config?.TRASHBIN_CUTOFF_DAYS || 30;
  const { push } = useRouter();
  const { hasChildren } = useDocUtils(doc);
  const {
    mutate: removeDoc,
    isError,
    error,
  } = useRemoveDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
    options: {
      onSuccess: () => {
        if (onSuccess) {
          onSuccess(doc);
        } else {
          void push('/');
        }

        onClose();

        toast(t('The document has been deleted.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
    },
  });

  useEffect(() => {
    const cancelButton = document.getElementById(CANCEL_BUTTON_ID);
    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.focus();
    }
  }, []);

  const handleClose = () => {
    onClose();
  };

  const handleDelete = () => {
    removeDoc({
      docId: doc.id,
    });
  };

  const handleCloseKeyDown = useKeyboardAction(handleClose);
  const handleDeleteKeyDown = useKeyboardAction(handleDelete);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-remove-doc-title"
      rightActions={
        <>
          <Button
            id={CANCEL_BUTTON_ID}
            aria-label={t('Cancel the deletion')}
            color="secondary"
            fullWidth
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Delete document')}
            color="danger"
            fullWidth
            onClick={handleDelete}
            onKeyDown={handleDeleteKeyDown}
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
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-remove-doc">
        {!isError && (
          <Text $size="sm" $variation="600" $display="inline-block" as="p">
            {hasChildren ? (
              <Trans t={t}>
                This document and <strong>any sub-documents</strong> will be
                placed in the trashbin. You can restore it within{' '}
                {{ days: trashBinCutoffDays }} days.
              </Trans>
            ) : (
              t(
                'This document will be placed in the trashbin. You can restore it within {{days}} days.',
                { days: trashBinCutoffDays },
              )
            )}
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
