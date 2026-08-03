import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
  useTrans,
} from '@/docs/doc-management';
import ContentCopyIcon from '@/icons/content_copy.svg';
import DeleteIcon from '@/icons/delete.svg';
import DocMoveInIcon from '@/icons/doc-move-in.svg';
import GroupIcon from '@/icons/group.svg';
import LeaveIcon from '@/icons/leave.svg';
import MoreIcon from '@/icons/more_horiz.svg';
import StarSlashIcon from '@/icons/star-slash.svg';
import StarIcon from '@/icons/star.svg';
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

const ConfirmationLeaveModal = dynamic(
  () =>
    import('@/docs/doc-share/components/ConfirmationLeaveModal').then(
      (mod) => ({
        default: mod.ConfirmationLeaveModal,
      }),
    ),
  { ssr: false },
);

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();
  const { restoreFocus, addLastFocus } = useFocusStore();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalLeaveOpen, setIsModalLeaveOpen] = useState(false);
  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isModalMoveOpen, setIsModalMoveOpen] = useState(false);
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

  const options: DropdownMenuItem[] = [
    {
      label: doc.is_favorite ? t('Unstar') : t('Star'),
      icon: doc.is_favorite ? (
        <StarSlashIcon width={24} height={24} aria-hidden="true" />
      ) : (
        <StarIcon width={24} height={24} aria-hidden="true" />
      ),
      callback: () => {
        if (doc.is_favorite) {
          removeFavoriteDoc.mutate({ id: doc.id });
        } else {
          makeFavoriteDoc.mutate({ id: doc.id });
        }
      },
      testId: `docs-grid-actions-${doc.is_favorite ? 'unstar' : 'star'}-${doc.id}`,
      showSeparator: true,
    },
    {
      label: t('Share'),
      icon: <GroupIcon width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalShareOpen(true);
      },

      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Move into a doc'),
      icon: <DocMoveInIcon width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalMoveOpen(true);
      },
      testId: `docs-grid-actions-move-${doc.id}`,
      isHidden: !doc.abilities.move,
    },
    {
      label: t('Duplicate'),
      icon: <ContentCopyIcon width={24} height={24} aria-hidden="true" />,
      isDisabled: !doc.abilities.duplicate,
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
      label: t('Leave'),
      icon: <LeaveIcon width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalLeaveOpen(true);
      },
    },
    {
      label: t('Delete'),
      icon: <DeleteIcon width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalRemoveOpen(true);
      },
      isHidden: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  return (
    <>
      <DropdownMenu
        options={options}
        isOpen={openDropdown}
        shouldCloseOnInteractOutside={() => true}
        onOpenChange={setOpenDropdown}
      >
        <Button
          data-testid={`docs-grid-actions-button-${doc.id}`}
          aria-label={t(
            'Open the menu of actions for the document: {{title}}',
            {
              title: doc.title || untitledDocument,
            },
          )}
          size="small"
          icon={<MoreIcon width={16} height={16} aria-hidden="true" />}
          color="neutral"
          variant="tertiary"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpenDropdown((o) => !o);
            addLastFocus(e.currentTarget);
          }}
        />
      </DropdownMenu>

      {isModalRemoveOpen && (
        <ModalRemoveDoc
          onClose={() => {
            setIsModalRemoveOpen(false);
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {isModalShareOpen && (
        <DocShareModal
          doc={doc}
          onClose={() => {
            setIsModalShareOpen(false);
            restoreFocus();
          }}
        />
      )}
      {isModalLeaveOpen && (
        <ConfirmationLeaveModal
          onClose={() => {
            setIsModalLeaveOpen(false);
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {isModalMoveOpen && (
        <DocMoveModal
          doc={doc}
          onClose={() => {
            setIsModalMoveOpen(false);
            restoreFocus();
          }}
          isOpen={isModalMoveOpen}
        />
      )}
    </>
  );
};
