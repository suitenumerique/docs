import {
  Button,
  Checkbox,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { TreeContextType } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, ButtonCloseModal, ButtonLink, Text } from '@/components';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid/api/useDocsTrashbin';

import { KEY_LIST_DOC, useDuplicateDoc } from '../api';
import { useRemoveDoc } from '../api/useRemoveDoc';
import { useDocUtils } from '../hooks';
import { type Doc } from '../types';

const ModalStyle = createGlobalStyle`
  .c__modal__footer {
    margin-top: 0;
  }
  .c__toast__content__children{
    flex-shrink: 0;
    flex-grow: 0;
  }
`;

interface ConfirmationDuplicateModalProps {
  doc: Doc;
  onClose: () => void;
  treeContext: TreeContextType<Doc | null> | null;
}

export const ConfirmationDuplicateModal = ({
  doc,
  onClose,
  treeContext,
}: ConfirmationDuplicateModalProps) => {
  const { t } = useTranslation();
  const { isTopRoot } = useDocUtils(doc);
  const router = useRouter();
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
      toast(
        isTopRoot
          ? t('Document duplicated to My docs')
          : t('Document duplicated'),
        VariantType.INFO,
        {
          duration: 10000,
          actions: (
            <ToastActions
              duplicatedDocId={data.id}
              originalDocId={doc.id}
              isTopRoot={isTopRoot}
              onClose={onCloseToast}
              treeContext={treeContext}
            />
          ),
        },
      );

      if (!isTopRoot) {
        void router.push(`/docs/${data.id}`);
      }
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
        {isTopRoot && t('The copy will be private and added to My docs.')}
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
  isTopRoot,
  onClose,
  duplicatedDocId,
  originalDocId,
  treeContext,
}: {
  isTopRoot: boolean;
  onClose: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  duplicatedDocId: string;
  originalDocId: string;
  treeContext: TreeContextType<Doc | null> | null;
}) => {
  const { t } = useTranslation();
  const { mutate: removeDoc } = useRemoveDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
  });
  const openRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const router = useRouter();

  // When the toast is displayed, we want to focus the "Open" button for accessibility reasons.
  useEffect(() => {
    openRef.current?.focus();
  }, []);

  return (
    <Box $direction="row" $gap="xs">
      <ButtonLink
        ref={openRef}
        variant="tertiary"
        href={`/docs/${isTopRoot ? duplicatedDocId : originalDocId}`}
        onClick={onClose}
      >
        {isTopRoot
          ? t('Open', {
              description: 'Action to open the duplicated document',
            })
          : t('Back to original', {
              description: 'Back to the original document',
            })}
      </ButtonLink>
      <Button
        variant="tertiary"
        onClick={(e) => {
          removeDoc({ docId: duplicatedDocId });
          onClose(e);
          treeContext?.setRoot(null);
          if (!isTopRoot) {
            void router.push(`/docs/${originalDocId}`);
          }
        }}
      >
        {t('Undo')}
      </Button>
    </Box>
  );
};
