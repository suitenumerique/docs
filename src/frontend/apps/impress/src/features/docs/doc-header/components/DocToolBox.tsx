import { Button, useModal } from '@gouvfr-lasuite/cunningham-react';
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

import AddLinkSVG from '@/assets/icons/ui-kit/add_link.svg';
import ContentCopySVG from '@/assets/icons/ui-kit/content_copy.svg';
import DeleteSVG from '@/assets/icons/ui-kit/delete.svg';
import DownloadSVG from '@/assets/icons/ui-kit/download.svg';
import SharedSVG from '@/assets/icons/ui-kit/group.svg';
import HistorySVG from '@/assets/icons/ui-kit/history.svg';
import KeepSVG from '@/assets/icons/ui-kit/keep.svg';
import KeepOffSVG from '@/assets/icons/ui-kit/keep_off.svg';
import MarkdownCopySVG from '@/assets/icons/ui-kit/markdown_copy.svg';
import MoreSVG from '@/assets/icons/ui-kit/more_horiz.svg';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCopyDocLink,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDocUtils,
  useDuplicateDoc,
} from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useFocusStore, useResponsiveStore } from '@/stores';

import { useCopyCurrentEditorToClipboard } from '../hooks/useCopyCurrentEditorToClipboard';

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

const ModalExport =
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? dynamic(
        () =>
          import('@/docs/doc-export/components/ModalExport').then((mod) => ({
            default: mod.ModalExport,
          })),
        { ssr: false },
      )
    : null;

const PresenterOverlay = dynamic(
  () =>
    import('@/docs/doc-presenter').then((mod) => ({
      default: mod.PresenterOverlay,
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
  const { isTopRoot } = useDocUtils(doc);
  const { authenticated } = useAuth();
  const copyCurrentEditorToClipboard = useCopyCurrentEditorToClipboard();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalExportOpen, setIsModalExportOpen] = useState(false);
  const shareModal = useModal();
  const [isPresenterOpen, setIsPresenterOpen] = useState(false);
  const selectHistoryModal = useModal();

  const { restoreFocus } = useFocusStore();
  const { isMobile } = useResponsiveStore();
  const copyDocLink = useCopyDocLink(doc.id);
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
      isHidden: !doc.abilities.favorite,
      testId: `docs-actions-${doc.is_favorite ? 'unpin' : 'pin'}-${doc.id}`,
    },
    { type: 'separator' },
    {
      label: t('Present'),
      icon: <Present width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsPresenterOpen(true);
      },
      isHidden: Boolean(doc.deleted_at) || isMobile,
      testId: `docs-actions-present-${doc.id}`,
    },
    {
      label: t('Copy link'),
      icon: <AddLinkSVG width={24} height={24} aria-hidden="true" />,
      callback: copyDocLink,
    },
    {
      label: t('Share'),
      icon: <SharedSVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        shareModal.open();
      },
      isHidden: !isTopRoot || !authenticated,
    },
    {
      label: t('Download'),
      icon: <DownloadSVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        setIsModalExportOpen(true);
      },
      isHidden: !ModalExport,
    },
    {
      label: t('Copy as {{format}}', { format: 'Markdown' }),
      icon: <MarkdownCopySVG width={24} height={24} aria-hidden="true" />,
      callback: () => {
        void copyCurrentEditorToClipboard('markdown');
      },
      showSeparator: isMobile || !doc.abilities.versions_list,
    },
    {
      label: t('Version history'),
      icon: <HistorySVG width={24} height={24} aria-hidden="true" />,
      isDisabled: !doc.abilities.versions_list,
      callback: () => {
        selectHistoryModal.open();
      },
      isHidden: isMobile || !doc.abilities.versions_list,
      showSeparator: true,
    },
    {
      label: t('Duplicate'),
      icon: <ContentCopySVG width={24} height={24} aria-hidden="true" />,
      isDisabled: !doc.abilities.duplicate,
      callback: () => {
        duplicateDoc({
          docId: doc.id,
          with_accesses: false,
          canSave: doc.abilities.partial_update,
        });
      },
      isHidden: !doc.abilities.duplicate,
      showSeparator: true,
    },
    {
      label: t('Delete'),
      icon: <DeleteSVG width={24} height={24} aria-hidden="true" />,
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
          }}
        />
      </DropdownMenu>

      {isModalExportOpen && ModalExport && (
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
            const isTopParent = doc.id === treeContext?.root?.id;
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
      {selectHistoryModal.isOpen && (
        <ModalSelectVersion
          onClose={() => {
            selectHistoryModal.close();
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {shareModal.isOpen && (
        <DocShareModal
          onClose={() => {
            shareModal.close();
            restoreFocus();
          }}
          doc={doc}
          isRootDoc={treeContext?.root?.id === doc.id}
        />
      )}

      {isPresenterOpen && (
        <PresenterOverlay
          doc={doc}
          onClose={() => {
            setIsPresenterOpen(false);
            restoreFocus();
          }}
        />
      )}
    </>
  );
};
