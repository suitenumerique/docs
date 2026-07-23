import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ContentCopySVG from '@/assets/icons/ui-kit/content_copy.svg';
import DeleteSVG from '@/assets/icons/ui-kit/delete.svg';
import DocMoveInSVG from '@/assets/icons/ui-kit/doc-move-in.svg';
import GroupSVG from '@/assets/icons/ui-kit/group.svg';
import KeepSVG from '@/assets/icons/ui-kit/keep.svg';
import KeepOffSVG from '@/assets/icons/ui-kit/keep_off.svg';
import LeaveSVG from '@/assets/icons/ui-kit/leave.svg';
import MoreSVG from '@/assets/icons/ui-kit/more_horiz.svg';
import { Icon } from '@/components/Icon';
import {
  Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
  useRestoreDoc,
  useTrans,
} from '@/docs/doc-management';
import { focusMainContentStart } from '@/layouts/utils';
import { useFocusStore } from '@/stores';

import { KEY_LIST_DOC_TRASHBIN } from '../api/useDocsTrashbin';

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
      label: doc.is_favorite ? t('Unpin') : t('Pin'),
      icon: doc.is_favorite ? (
        <KeepOffSVG width={24} height={24} aria-hidden="true" />
      ) : (
        <KeepSVG width={24} height={24} aria-hidden="true" />
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
      icon: <GroupSVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalShareOpen(true);
      },

      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Move into a doc'),
      icon: <DocMoveInSVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalMoveOpen(true);
      },
      testId: `docs-grid-actions-move-${doc.id}`,
      isHidden: !doc.abilities.move,
    },
    {
      label: t('Duplicate'),
      icon: <ContentCopySVG width={24} height={24} aria-hidden="true" />,
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
      icon: <LeaveSVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalLeaveOpen(true);
      },
    },
    {
      label: t('Delete'),
      icon: <DeleteSVG width={24} height={24} aria-hidden="true" />,
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
  const { mutate: restoreDoc, error } = useRestoreDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
    options: {
      onSuccess: (_data) => {
        toast(t('The document has been restored.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
      onError: () => {
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

  if (!doc.abilities.restore) {
    return null;
  }

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
        icon={<MoreSVG width={16} height={16} aria-hidden="true" />}
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
