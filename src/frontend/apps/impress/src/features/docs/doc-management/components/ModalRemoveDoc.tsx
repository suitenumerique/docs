import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { useConfig } from '@/core';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid';

import { KEY_DOC, KEY_LIST_FAVORITE_DOC } from '../api';
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
  const { hasChildren } = useDocUtils(doc);
  const cancelButtonRef = useRef<ButtonElement>(null);

  const {
    mutate: removeDoc,
    isError,
    error,
  } = useRemoveDoc({
    listInvalidQueries: [
      KEY_LIST_DOC,
      KEY_LIST_DOC_TRASHBIN,
      KEY_DOC,
      KEY_LIST_FAVORITE_DOC,
    ],
    options: {
      onSuccess: () => {
        if (onSuccess) {
          onSuccess(doc);
        }

        onClose();

        toast(t('The document has been deleted.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
    },
  });
  // react-aria Popover restores focus to its trigger asynchronously
  // when closing, which races with autoFocus when the modal is opened
  // from a dropdown. This ensures focus wins after that restoration.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDelete = () => {
    removeDoc({ docId: doc.id });
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={onClose}
      aria-label={t('Delete a doc')}
      rightActions={
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={t('Cancel the deletion')}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Delete document')}
            color="error"
            fullWidth
            onClick={handleDelete}
          >
            {t('Delete')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <>
          <Text
            $size="h6"
            as="h1"
            id="modal-remove-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Delete a doc')}
          </Text>
          <Box $position="absolute" $css="top: 8px; right: 8px;">
            <ButtonCloseModal
              aria-label={t('Close the delete modal')}
              onClick={onClose}
            />
          </Box>
        </>
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
