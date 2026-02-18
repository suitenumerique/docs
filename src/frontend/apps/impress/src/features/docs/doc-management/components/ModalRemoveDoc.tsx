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
import { Trans, useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { useConfig } from '@/core';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid';
import { useFocusOnMount, useKeyboardAction } from '@/hooks';

import { KEY_LIST_DOC } from '../api/useDocs';
import { useRemoveDoc } from '../api/useRemoveDoc';
import { useDocUtils } from '../hooks';
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
  const { data: config } = useConfig();
  const trashBinCutoffDays = config?.TRASHBIN_CUTOFF_DAYS || 30;
  const { push } = useRouter();
  const { hasChildren } = useDocUtils(doc);
  const cancelButtonRef = useRef<ButtonElement>(null);
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

  useFocusOnMount(cancelButtonRef);

  const keyboardAction = useKeyboardAction();

  const handleClose = () => {
    onClose();
  };

  const handleDelete = () => {
    removeDoc({ docId: doc.id });
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleDeleteKeyDown = keyboardAction(handleDelete);

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
            ref={cancelButtonRef}
            aria-label={t('Cancel the deletion')}
            variant="secondary"
            fullWidth
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Delete document')}
            color="error"
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
          <Text
            $size="sm"
            $variation="secondary"
            $display="inline-block"
            as="p"
          >
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
