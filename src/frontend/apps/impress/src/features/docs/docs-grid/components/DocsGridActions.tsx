import { useModal } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import {
  Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  ModalRemoveDoc,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
  useTrans,
} from '@/docs/doc-management';
import { DocShareModal } from '@/docs/doc-share';

import { DocMoveModal } from './DocMoveModal';

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();

  const deleteModal = useModal();
  const shareModal = useModal();
  const importModal = useModal();
  const { untitledDocument } = useTrans();

  const { mutate: duplicateDoc } = useDuplicateDoc();

  const removeFavoriteDoc = useDeleteFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_FAVORITE_DOC],
  });
  const makeFavoriteDoc = useCreateFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_FAVORITE_DOC],
  });

  const options: DropdownMenuOption[] = [
    {
      label: doc.is_favorite ? t('Unpin') : t('Pin'),
      icon: 'push_pin',
      callback: () => {
        if (doc.is_favorite) {
          removeFavoriteDoc.mutate({ id: doc.id });
        } else {
          makeFavoriteDoc.mutate({ id: doc.id });
        }
      },
      testId: `docs-grid-actions-${doc.is_favorite ? 'unpin' : 'pin'}-${doc.id}`,
      showSeparator: true,
    },
    {
      label: t('Share'),
      icon: 'group',
      callback: () => {
        shareModal.open();
      },

      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Move into a doc'),
      icon: 'copy_all',
      callback: () => {
        importModal.open();
      },
      testId: `docs-grid-actions-import-${doc.id}`,
      show: doc.abilities.move,
    },
    {
      label: t('Duplicate'),
      icon: 'content_copy',
      disabled: !doc.abilities.duplicate,
      callback: () => {
        duplicateDoc({
          docId: doc.id,
          with_accesses: false,
          canSave: false,
        });
      },
      showSeparator: true,
    },
    {
      label: t('Delete'),
      icon: 'delete',
      callback: () => deleteModal.open(),
      disabled: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  const documentTitle = doc.title || untitledDocument;
  const menuLabel = t('Open the menu of actions for the document: {{title}}', {
    title: documentTitle,
  });

  return (
    <>
      <DropdownMenu
        options={options}
        label={menuLabel}
        aria-label={t('More options')}
        buttonCss={css`
          &:hover {
            background-color: unset;
          }
        `}
      >
        <Icon
          data-testid={`docs-grid-actions-button-${doc.id}`}
          iconName="more_horiz"
          $theme="brand"
          $variation="secondary"
          $css={css`
            cursor: pointer;
            &:hover {
              opacity: 0.8;
            }
          `}
          aria-hidden="true"
        />
      </DropdownMenu>

      {deleteModal.isOpen && (
        <ModalRemoveDoc onClose={deleteModal.onClose} doc={doc} />
      )}
      {shareModal.isOpen && (
        <DocShareModal doc={doc} onClose={shareModal.close} />
      )}
      {importModal.isOpen && (
        <DocMoveModal
          doc={doc}
          onClose={importModal.close}
          isOpen={importModal.isOpen}
        />
      )}
    </>
  );
};
