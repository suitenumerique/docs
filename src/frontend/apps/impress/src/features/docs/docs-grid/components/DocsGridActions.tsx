import { useModal } from '@gouvfr-lasuite/cunningham-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import ContentCopySVG from '@/assets/icons/ui-kit/content_copy.svg';
import DeleteSVG from '@/assets/icons/ui-kit/delete.svg';
import DocMoveInSVG from '@/assets/icons/ui-kit/doc-move-in.svg';
import GroupSVG from '@/assets/icons/ui-kit/group.svg';
import KeepSVG from '@/assets/icons/ui-kit/keep.svg';
import KeepOffSVG from '@/assets/icons/ui-kit/keep_off.svg';
import { DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import {
  Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
  useTrans,
} from '@/docs/doc-management';
import { focusMainContentStart } from '@/layouts/utils';
import { useFocusStore } from '@/stores';

import { DocMoveModal } from './DocMoveModal';

const DocShareModal = dynamic(
  () =>
    import('@/docs/doc-share/components/DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

const ModalRemoveDoc = dynamic(
  () =>
    import('@/docs/doc-management/components/ModalRemoveDoc').then((mod) => ({
      default: mod.ModalRemoveDoc,
    })),
  { ssr: false },
);

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();
  const restoreFocus = useFocusStore((state) => state.restoreFocus);

  const deleteModal = useModal();
  const shareModal = useModal();
  const importModal = useModal();
  const { untitledDocument } = useTrans();

  const { mutate: duplicateDoc } = useDuplicateDoc({
    onSuccess: () => {
      requestAnimationFrame(() => {
        focusMainContentStart({ preventScroll: true });
      });
    },
  });

  const removeFavoriteDoc = useDeleteFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_FAVORITE_DOC],
  });
  const makeFavoriteDoc = useCreateFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_FAVORITE_DOC],
  });

  const options: DropdownMenuOption[] = [
    {
      label: doc.is_favorite ? t('Unpin') : t('Pin'),
      icon: doc.is_favorite ? (
        <KeepOffSVG width={24} height={24} />
      ) : (
        <KeepSVG width={24} height={24} />
      ),
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
      icon: <GroupSVG width={24} height={24} />,
      callback: () => {
        shareModal.open();
      },

      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Move into a doc'),
      icon: <DocMoveInSVG width={24} height={24} />,
      callback: () => {
        importModal.open();
      },
      testId: `docs-grid-actions-import-${doc.id}`,
      show: doc.abilities.move,
    },
    {
      label: t('Duplicate'),
      icon: <ContentCopySVG width={24} height={24} />,
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
      icon: <DeleteSVG width={24} height={24} />,
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
        <ModalRemoveDoc
          onClose={() => {
            deleteModal.onClose();
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {shareModal.isOpen && (
        <DocShareModal
          doc={doc}
          onClose={() => {
            shareModal.close();
            restoreFocus();
          }}
        />
      )}
      {importModal.isOpen && (
        <DocMoveModal
          doc={doc}
          onClose={() => {
            importModal.close();
            restoreFocus();
          }}
          isOpen={importModal.isOpen}
        />
      )}
    </>
  );
};
