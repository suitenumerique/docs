import { Button } from '@gouvfr-lasuite/cunningham-react';
import {
  DropdownMenu,
  DropdownMenuItem,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { Present } from '@gouvfr-lasuite/ui-kit/icons';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePresenterStore } from '@/docs/doc-presenter/stores';
import { useAuth } from '@/features/auth';
import ContentCopyIcon from '@/icons/copy.svg';
import DownloadSVG from '@/icons/download.svg';
import HistorySVG from '@/icons/history.svg';
import LeaveSVG from '@/icons/leave.svg';
import LinkIcon from '@/icons/link.svg';
import MoreSVG from '@/icons/more_horiz.svg';
import PrintIcon from '@/icons/print.svg';
import SharedIcon from '@/icons/shared.svg';
import StarSlashIcon from '@/icons/star-slash.svg';
import StarIcon from '@/icons/star.svg';
import DeleteIcon from '@/icons/trash.svg';
import { useFocusStore, useResponsiveStore } from '@/stores';

import { printDocumentWithStyles } from '../../doc-export/utils_print';
import {
  KEY_DOC,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
} from '../api';
import { useCopyDocLink } from '../hooks';
import { Doc } from '../types';

const ModalRemoveDoc = dynamic(
  () =>
    import('@/docs/doc-management/components/ModalRemoveDoc').then((mod) => ({
      default: mod.ModalRemoveDoc,
    })),
  { ssr: false },
);

const ModalSelectVersion = dynamic(
  () =>
    import('@/docs/doc-versioning/components/ModalSelectVersion').then(
      (mod) => ({ default: mod.ModalSelectVersion }),
    ),
  { ssr: false },
);

const DocShareModal = dynamic(
  () =>
    import('@/docs/doc-share/components/DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
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

const ModalExport = dynamic(
  () =>
    import('@/docs/doc-export/components/ModalExport').then((mod) => ({
      default: mod.ModalExport,
    })),
  { ssr: false },
);

interface DocToolBoxProps {
  doc: Doc;
}

export const DocToolBox = ({ doc }: DocToolBoxProps) => {
  const { t } = useTranslation();
  const treeContext = useTreeContext<Doc>();
  const router = useRouter();
  const isTopParent = doc.id === treeContext?.root?.id; // it can be a child but not for the current user
  const { authenticated } = useAuth();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalExportOpen, setIsModalExportOpen] = useState(false);
  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isModalHistoryOpen, setIsModalHistoryOpen] = useState(false);
  const [isModalLeaveOpen, setIsModalLeaveOpen] = useState(false);

  const { restoreFocus, addLastFocus } = useFocusStore();
  const { isMobile } = useResponsiveStore();
  const copyDocLink = useCopyDocLink(doc.id);
  const openPresenter = usePresenterStore((state) => state.open);
  const { mutate: duplicateDoc } = useDuplicateDoc({
    onSuccess: (data) => {
      void router.push(`/docs/${data.id}`);
    },
  });
  const removeFavoriteDoc = useDeleteFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_DOC, KEY_LIST_FAVORITE_DOC],
  });
  const makeFavoriteDoc = useCreateFavoriteDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_DOC, KEY_LIST_FAVORITE_DOC],
  });

  const options: DropdownMenuItem[] = [
    {
      label: t('Copy link', {
        description: 'Dropdown menu item to copy the document link',
      }),
      icon: <LinkIcon width={18} height={18} aria-hidden="true" />,
      callback: copyDocLink,
    },
    {
      label: t('Share', {
        description: 'Dropdown menu item to share the document',
      }),
      icon: <SharedIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalShareOpen(true);
      },
      isHidden: !authenticated,
    },
    { type: 'separator' },
    {
      label: t('Present', {
        description:
          'Dropdown menu item to open the document in presentation mode',
      }),
      icon: <Present width={18} height={18} aria-hidden="true" />,
      callback: () => {
        openPresenter(0);
      },
      isHidden: Boolean(doc.deleted_at) || isMobile,
      testId: `docs-actions-present-${doc.id}`,
    },
    {
      label: t('Download', {
        description: 'Dropdown menu item to download the document',
      }),
      icon: <DownloadSVG width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalExportOpen(true);
      },
    },
    {
      label: t('Print', {
        description: 'Dropdown menu item to print the document',
      }),
      icon: <PrintIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        printDocumentWithStyles();
      },
    },
    { type: 'separator' },
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
      isHidden: !doc.abilities.favorite,
      testId: `docs-actions-${doc.is_favorite ? 'unstar' : 'star'}-${doc.id}`,
    },
    {
      label: t('Duplicate', {
        description: 'Dropdown menu item to duplicate the document',
      }),
      icon: <ContentCopyIcon width={18} height={18} aria-hidden="true" />,
      isDisabled: !doc.abilities.duplicate,
      callback: () => {
        duplicateDoc({
          docId: doc.id,
          with_accesses: false,
          canSave: doc.abilities.partial_update,
        });
      },
      isHidden: !doc.abilities.duplicate,
    },
    { type: 'separator' },
    {
      label: t('History', {
        description: 'Dropdown menu item to view the document history',
      }),
      icon: <HistorySVG width={18} height={18} aria-hidden="true" />,
      isDisabled: !doc.abilities.versions_list,
      callback: () => {
        setIsModalHistoryOpen(true);
      },
      isHidden: isMobile || !doc.abilities.versions_list,
      showSeparator: true,
    },
    {
      label: t('Leave', {
        description: 'Dropdown menu item to leave the document',
      }),
      icon: <LeaveSVG width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalLeaveOpen(true);
      },
      /**
       * A user can only leave a top parent because we cannot
       * leave a child if the parent is not left.
       * ⚠️ This doc can still be a child for other users.
       */
      isHidden: !isTopParent,
    },
    {
      label: t('Delete', {
        description: 'Dropdown menu item to delete the document',
      }),
      icon: <DeleteIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalRemoveOpen(true);
      },
      isHidden: !doc.abilities.destroy,
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
          aria-label={t('Open the document options')}
          size="small"
          icon={<MoreSVG width={24} height={24} aria-hidden="true" />}
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

      {isModalExportOpen && (
        <ModalExport
          onClose={() => {
            setIsModalExportOpen(false);
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {isModalRemoveOpen && (
        <ModalRemoveDoc
          onClose={() => {
            setIsModalRemoveOpen(false);
            restoreFocus();
          }}
          doc={doc}
          onSuccess={() => {
            const parentId =
              treeContext?.treeData.getParentId(doc.id) ||
              treeContext?.root?.id;

            if (isTopParent) {
              void router.push(`/`);
            } else if (parentId) {
              void router.push(`/docs/${parentId}`).then(() => {
                setTimeout(() => {
                  treeContext?.treeData.deleteNode(doc.id);
                }, 100);
              });
            }
          }}
        />
      )}
      {isModalHistoryOpen && (
        <ModalSelectVersion
          onClose={() => {
            setIsModalHistoryOpen(false);
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {isModalShareOpen && (
        <DocShareModal
          onClose={() => {
            setIsModalShareOpen(false);
            restoreFocus();
          }}
          doc={doc}
          isRootDoc={isTopParent}
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
    </>
  );
};
