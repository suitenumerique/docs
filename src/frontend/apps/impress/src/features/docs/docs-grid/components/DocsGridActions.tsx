import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import {
  type Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
  useRestoreDoc,
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

import { KEY_LIST_DOC_TRASHBIN } from '../api';

const DocMoveModal = dynamic(
  () =>
    import('@/docs/doc-management/components/DocMoveModal').then((mod) => ({
      default: mod.DocMoveModal,
    })),
  { ssr: false },
);

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
  isInTrashbin?: boolean;
}

export const DocsGridActions = ({
  doc,
  isInTrashbin,
}: DocsGridActionsProps) => {
  return isInTrashbin ? (
    <DocsGridTrashbinActions doc={doc} />
  ) : (
    <DocsGridActionsGlobal doc={doc} />
  );
};

const DocsGridActionsGlobal = ({ doc }: { doc: Doc }) => {
  const { t } = useTranslation();
  const { restoreFocus } = useFocusStore();
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalLeaveOpen, setIsModalLeaveOpen] = useState(false);
  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isModalMoveOpen, setIsModalMoveOpen] = useState(false);

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
        <StarSlashIcon width={18} height={18} aria-hidden="true" />
      ) : (
        <StarIcon width={18} height={18} aria-hidden="true" />
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
      icon: <GroupIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalShareOpen(true);
      },

      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Move into a doc'),
      icon: <DocMoveInIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalMoveOpen(true);
      },
      testId: `docs-grid-actions-move-${doc.id}`,
      isHidden: !doc.abilities.move,
    },
    {
      label: t('Duplicate'),
      icon: <ContentCopyIcon width={18} height={18} aria-hidden="true" />,
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
      icon: <LeaveIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalLeaveOpen(true);
      },
    },
    {
      label: t('Delete'),
      icon: <DeleteIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalRemoveOpen(true);
      },
      isHidden: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  return (
    <>
      <DocsGridDropdown doc={doc} options={options} />
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

interface DocsGridTrashbinActionsProps {
  doc: Doc;
}

export const DocsGridTrashbinActions = ({
  doc,
}: DocsGridTrashbinActionsProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { mutate: restoreDoc } = useRestoreDoc({
    listInvalidQueries: [
      KEY_LIST_DOC,
      KEY_LIST_DOC_TRASHBIN,
      KEY_LIST_FAVORITE_DOC,
    ],
    options: {
      onSuccess: (_data) => {
        toast(t('The document has been restored.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
      onError: (error) => {
        toast(
          t('An error occurred while restoring the document: {{error}}', {
            error: error?.message,
          }),
          VariantType.ERROR,
          {
            duration: 4000,
          },
        );
      },
    },
  });

  if (!doc.abilities.restore) {
    return null;
  }

  const options: DropdownMenuItem[] = [
    {
      label: t('Restore'),
      icon: (
        <Icon
          $size="20px"
          iconName="undo"
          aria-hidden="true"
          variant="symbols-outlined"
        />
      ),
      callback: () => {
        restoreDoc({
          docId: doc.id,
        });
      },
      testId: `docs-grid-actions-restore-${doc.id}`,
    },
  ];

  return <DocsGridDropdown doc={doc} options={options} />;
};

interface DocsGridDropdownProps {
  doc: Doc;
  options: DropdownMenuItem[];
}

const DocsGridDropdown = ({ doc, options }: DocsGridDropdownProps) => {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState(false);
  const { addLastFocus } = useFocusStore();
  const { untitledDocument } = useTrans();

  return (
    <DropdownMenu
      options={options}
      isOpen={openDropdown}
      shouldCloseOnInteractOutside={() => true}
      onOpenChange={setOpenDropdown}
    >
      <Button
        data-testid={`docs-grid-actions-button-${doc.id}`}
        aria-label={t('Open the menu of actions for the document: {{title}}', {
          title: doc.title || untitledDocument,
        })}
        size="nano"
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
  );
};
