import {
  Button,
  Checkbox,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, ButtonCloseModal, ButtonLink, Text } from '@/components';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid/api/useDocsTrashbin';

import { KEY_LIST_DOC, useDuplicateDoc } from '../api';
import { useRemoveDoc } from '../api/useRemoveDoc';
import { type Doc } from '../types';

const ModalStyle = createGlobalStyle`
  .c__modal__footer {
    margin-top: 0;
  }
`;

interface ConfirmationDuplicateModalProps {
  doc: Doc;
  onClose: () => void;
}

export const ConfirmationDuplicateModal = ({
  doc,
  onClose,
}: ConfirmationDuplicateModalProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const [isWithSubdocs, setIsWithSubdocs] = useState(true);
  const { mutate: duplicateDoc } = useDuplicateDoc({
    onSuccess: (data) => {
      onClose();

      const onCloseToast = (
        e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
      ) => {
        const toastEl = e.currentTarget.closest<HTMLElement>('[role="alert"]');
        if (toastEl) {
          toastEl.style.display = 'none';
        }
      };
      toast(t('Document duplicated to My docs'), VariantType.INFO, {
        duration: 10000,
        actions: <ToastActions docId={data.id} onClose={onCloseToast} />,
      });
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={onClose}
      aria-label={t('Confirmation to duplicate the document')}
      aria-labelledby="modal-duplicate-doc-title"
      aria-describedby="modal-duplicate-doc-desc"
      rightActions={
        <>
          <Button
            aria-label={t('Cancel the duplicate action')}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Confirm the duplicate action')}
            color="error"
            fullWidth
            onClick={() => {
              duplicateDoc({
                docId: doc.id,
                with_descendants: isWithSubdocs,
                canSave: doc.abilities.partial_update,
              });
            }}
          >
            {t('Duplicate')}
          </Button>
        </>
      }
      size={ModalSize.SMALL}
      title={
        <>
          <Text
            $size="h6"
            as="h2"
            id="modal-duplicate-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Duplicate')}
          </Text>
          <Box $position="absolute" $css="top: 8px; right: 8px;">
            <ButtonCloseModal
              aria-label={t('Close the duplicate modal')}
              onClick={onClose}
            />
          </Box>
        </>
      }
    >
      <ModalStyle />
      <Text
        id="modal-duplicate-doc-desc"
        className="--docs--modal-duplicate-doc"
        $size="sm"
        $variation="secondary"
        as="p"
        $margin="0"
      >
        {t('The copy will be private and added to My docs.')}
      </Text>
      <Box $margin={{ vertical: 'base' }}>
        <Checkbox
          label={t('Duplicate subdocs')}
          checked={isWithSubdocs}
          onChange={(e) => setIsWithSubdocs(e.target.checked)}
        />
      </Box>
    </Modal>
  );
};

const ToastActions = ({
  docId,
  onClose,
}: {
  docId: string;
  onClose: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
}) => {
  const { t } = useTranslation();
  const { mutate: removeDoc } = useRemoveDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
  });
  const openRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  // When the toast is displayed, we want to focus the "Open" button for accessibility reasons.
  useEffect(() => {
    openRef.current?.focus();
  }, []);

  return (
    <Box $direction="row" $gap="xs">
      <ButtonLink
        ref={openRef}
        variant="tertiary"
        href={`/docs/${docId}`}
        onClick={onClose}
      >
        {t('Open')}
      </ButtonLink>
      <Button
        variant="tertiary"
        onClick={(e) => {
          removeDoc({ docId });
          onClose(e);
        }}
      >
        {t('Undo')}
      </Button>
    </Box>
  );
};
