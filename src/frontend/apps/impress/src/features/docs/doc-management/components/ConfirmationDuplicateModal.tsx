import {
  Button,
  Checkbox,
  Modal,
  ModalSize,
  type TreeContextType,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, ButtonCloseModal, ButtonLink, Text } from '@/components';
import {
  addDocToTree,
  deleteDocFromTreeAfterNavigate,
} from '@/docs/doc-tree/utils';
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

interface UseDuplicatedDocOptions {
  doc: Doc;
  treeContext: TreeContextType<Doc | null> | null;
  /**
   * Whether the duplicated doc is the one currently open. It only impacts
   * the "duplicated to My docs" toast message shown for a top-root doc.
   * Defaults to `true` since the confirmation modal only duplicates the
   * currently open doc.
   */
  isCurrentDoc?: boolean;
  onSuccess?: () => void;
}

export const useDuplicatedDoc = ({
  doc,
  treeContext,
  isCurrentDoc = true,
  onSuccess,
}: UseDuplicatedDocOptions) => {
  const { t } = useTranslation();
  const { isTopRoot } = useDocUtils(doc);
  const router = useRouter();
  const { toast } = useToastProvider();

  return useDuplicateDoc({
    onSuccess: (data) => {
      onSuccess?.();

      toast(
        isTopRoot && isCurrentDoc
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
              treeContext={treeContext}
            />
          ),
        },
      );

      if (!isTopRoot) {
        addDocToTree(treeContext, doc.id, data);
        void router.push(`/docs/${data.id}`);
      }
    },
  });
};

export const ConfirmationDuplicateModal = ({
  doc,
  onClose,
  treeContext,
}: ConfirmationDuplicateModalProps) => {
  const { t } = useTranslation();
  const { isTopRoot } = useDocUtils(doc);
  const [isWithSubdocs, setIsWithSubdocs] = useState(true);
  const { mutate: duplicateDoc, isPending: isDuplicatePending } =
    useDuplicatedDoc({
      doc,
      treeContext,
      onSuccess: onClose,
    });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={onClose}
      aria-label={t('Confirmation to duplicate the document')}
      aria-labelledby="modal-duplicate-doc-title"
      aria-describedby={isTopRoot ? 'modal-duplicate-doc-desc' : undefined}
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
            disabled={isDuplicatePending}
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
      {isTopRoot && (
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
      )}
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

export const ToastActions = ({
  isTopRoot,
  onClose,
  duplicatedDocId,
  originalDocId,
  treeContext,
}: {
  isTopRoot: boolean;
  onClose?: () => void;
  duplicatedDocId: string;
  originalDocId: string;
  treeContext: TreeContextType<Doc | null> | null;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToastProvider();
  const { mutateAsync: removeDoc } = useRemoveDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
    options: {
      onSuccess: () => {
        if (!isTopRoot) {
          deleteDocFromTreeAfterNavigate(
            treeContext,
            duplicatedDocId,
            router.push(`/docs/${originalDocId}`),
          );
        }
      },
      onError: (error) => {
        // A 401 is already handled globally (redirect to login), avoid a duplicate toast.
        if (error.status !== 401) {
          toast(t('The document could not be deleted.'), VariantType.ERROR, {
            duration: 4000,
          });
        }
      },
    },
  });
  const openRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const hideToastEl = (toastEl: HTMLElement | null) => {
    if (toastEl) {
      toastEl.style.display = 'none';
    }

    onClose?.();
  };

  const onCloseToast = (
    e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => {
    hideToastEl(e.currentTarget.closest<HTMLElement>('[role="alert"]'));
  };

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
        onClick={onCloseToast}
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
          const toastEl =
            e.currentTarget.closest<HTMLElement>('[role="alert"]');

          removeDoc({ docId: duplicatedDocId })
            .then(() => hideToastEl(toastEl))
            .catch(() => {
              // The error toast is already shown by the mutation's onError.
            });
        }}
      >
        {t('Undo')}
      </Button>
    </Box>
  );
};
