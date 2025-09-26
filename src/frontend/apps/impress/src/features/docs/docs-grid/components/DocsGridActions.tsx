import { useModal } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import {
  Doc,
  KEY_LIST_DOC,
  ModalRemoveDoc,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
} from '@/docs/doc-management';

interface DocsGridActionsProps {
  doc: Doc;
  openShareModal?: () => void;
}

export const DocsGridActions = ({
  doc,
  openShareModal,
}: DocsGridActionsProps) => {
  const { t } = useTranslation();

  const deleteModal = useModal();
  const { mutate: duplicateDoc } = useDuplicateDoc();

  const removeFavoriteDoc = useDeleteFavoriteDoc({
    listInvalideQueries: [KEY_LIST_DOC],
  });
  const makeFavoriteDoc = useCreateFavoriteDoc({
    listInvalideQueries: [KEY_LIST_DOC],
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
    },
    {
      label: t('Share'),
      icon: 'group',
      callback: () => {
        openShareModal?.();
      },

      testId: `docs-grid-actions-share-${doc.id}`,
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
    },
    {
      label: t('Remove'),
      icon: 'delete',
      callback: () => deleteModal.open(),
      disabled: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  const documentTitle = doc.title || t('Untitled document');
  const menuLabel = t('Open the menu of actions for the document: {{title}}', {
    title: documentTitle,
  });

  return (
    <>
      <DropdownMenu
        options={options}
        label={menuLabel}
        aria-label={t('More options')}
      >
        <Icon
          data-testid={`docs-grid-actions-button-${doc.id}`}
          iconName="more_horiz"
          $theme="primary"
          $variation="600"
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
    </>
  );
};
