import {
  Button,
  ButtonProps,
  DropdownMenu,
  DropdownMenuItem,
} from '@gouvfr-lasuite/ui-components';
import { Present } from '@gouvfr-lasuite/ui-components/icons';
import { announce } from '@react-aria/live-announcer';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import { getWordCount } from '@/docs/doc-editor/utils';
import { printDocumentWithStyles } from '@/docs/doc-export/utils_print';
import { usePresenterStore } from '@/docs/doc-presenter/stores';
import { useDetachDoc } from '@/docs/doc-tree/api/useDetach';
import { useTreeContextOrNull } from '@/docs/doc-tree/utils';
import { useAuth } from '@/features/auth';
import ContentCopyIcon from '@/icons/copy.svg';
import DocMoveInIcon from '@/icons/doc-move-in.svg';
import DocMoveOutIcon from '@/icons/doc-move-out.svg';
import DownloadIcon from '@/icons/download.svg';
import HistoryIcon from '@/icons/history.svg';
import LeaveIcon from '@/icons/leave.svg';
import LinkIcon from '@/icons/link.svg';
import MoreIcon from '@/icons/more_horiz.svg';
import PrintIcon from '@/icons/print.svg';
import SharedIcon from '@/icons/shared.svg';
import StarSlashIcon from '@/icons/star-slash.svg';
import StarIcon from '@/icons/star.svg';
import DeleteIcon from '@/icons/trash.svg';
import { useFocusStore, useResponsiveStore } from '@/stores';

import {
  KEY_DOC,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDuplicateDoc,
} from '../api';
import { useCopyDocLink, useTrans } from '../hooks';
import { Doc, Role } from '../types';

const DocMoveModal = dynamic(
  () =>
    import('@/docs/doc-management/components/DocMoveModal').then((mod) => ({
      default: mod.DocMoveModal,
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
  isCurrentDoc: boolean;
  buttonProps?: ButtonProps;
  onOpenChange?: (isOpen: boolean) => void;
  optionsDefault?: DropdownMenuItem[];
}

const DocToolBoxComponent = ({
  buttonProps,
  doc,
  isCurrentDoc,
  onOpenChange,
  optionsDefault,
}: DocToolBoxProps) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const treeContext = useTreeContextOrNull<Doc | null>();
  const router = useRouter();
  const isTopParent = !treeContext || doc.id === treeContext?.root?.id; // it can be a child but not for the current user
  const { authenticated } = useAuth();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalExportOpen, setIsModalExportOpen] = useState(false);
  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isModalHistoryOpen, setIsModalHistoryOpen] = useState(false);
  const [isModalLeaveOpen, setIsModalLeaveOpen] = useState(false);
  const [isModalMoveOpen, setIsModalMoveOpen] = useState(false);
  const { onClick: onButtonClick, ...buttonPropsLeft } = buttonProps || {};

  const editor = useEditorStore((state) => state.editor);
  const wordCountLabel = useMemo(() => {
    if (openDropdown && isCurrentDoc && editor) {
      return t('Word count: {{count}} words', {
        count: getWordCount(editor),
        description:
          'In the document options menu, showing the number of words in the document.',
      });
    }
  }, [editor, isCurrentDoc, openDropdown, t]);

  useEffect(() => {
    if (wordCountLabel) {
      announce(wordCountLabel, 'polite');
    }
  }, [wordCountLabel]);

  const { mutate: detachDoc } = useDetachDoc();

  const restoreFocus = useFocusStore((state) => state.restoreFocus);
  const addLastFocus = useFocusStore((state) => state.addLastFocus);
  const isMobile = useResponsiveStore((state) => state.isMobile);
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
      callback: () => {
        copyDocLink();
        restoreFocus();
      },
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
      showSeparator: isCurrentDoc,
    },
    {
      label: t('Present', {
        description:
          'Dropdown menu item to open the document in presentation mode',
      }),
      icon: <Present width={18} height={18} aria-hidden="true" />,
      callback: () => {
        openPresenter(0);
      },
      isHidden: Boolean(doc.deleted_at) || isMobile || !isCurrentDoc,
      testId: `docs-actions-present-${doc.id}`,
    },
    {
      label: t('Download', {
        description: 'Dropdown menu item to download the document',
      }),
      icon: <DownloadIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalExportOpen(true);
      },
      isHidden: !isCurrentDoc,
    },
    {
      label: t('Print', {
        description: 'Dropdown menu item to print the document',
      }),
      icon: <PrintIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        printDocumentWithStyles();
      },
      isHidden: !isCurrentDoc,
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

        restoreFocus();
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
    {
      label: t('Move to my docs'),
      isHidden: isTopParent || doc.user_role !== Role.OWNER,
      icon: <DocMoveOutIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        if (!treeContext?.root) {
          return;
        }

        detachDoc(
          { documentId: doc.id, rootId: treeContext.root.id },
          {
            onSuccess: () => {
              if (treeContext.root) {
                treeContext.treeData.setSelectedNode(treeContext.root);
                void router.push(`/docs/${treeContext.root.id}`).then(() => {
                  setTimeout(() => {
                    treeContext?.treeData.deleteNode(doc.id);
                  }, 100);
                });
              }
            },
          },
        );
      },
    },
    {
      label: t('Move into a doc'),
      icon: <DocMoveInIcon width={18} height={18} aria-hidden="true" />,
      callback: () => {
        setIsModalMoveOpen(true);
      },
      isHidden: !doc.abilities.move,
    },
    { type: 'separator' },
    {
      label: t('History', {
        description: 'Dropdown menu item to view the document history',
      }),
      icon: <HistoryIcon width={18} height={18} aria-hidden="true" />,
      isDisabled: !doc.abilities.versions_list,
      callback: () => {
        setIsModalHistoryOpen(true);
      },
      isHidden: isMobile || !doc.abilities.versions_list || !isCurrentDoc,
      showSeparator: true,
    },
    {
      label: t('Leave', {
        description: 'Dropdown menu item to leave the document',
      }),
      icon: <LeaveIcon width={18} height={18} aria-hidden="true" />,
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
      showSeparator: isCurrentDoc,
    },
  ];

  return (
    <>
      <DropdownMenu
        options={optionsDefault ?? options}
        isOpen={openDropdown}
        shouldCloseOnInteractOutside={() => true}
        onOpenChange={(isOpen) => {
          setOpenDropdown(isOpen);
          onOpenChange?.(isOpen);
        }}
        bottomMessage={
          wordCountLabel && <Text $variation="tertiary">{wordCountLabel}</Text>
        }
      >
        <Button
          aria-label={t('Open the document options: {{title}}', {
            title: doc.title || untitledDocument,
          })}
          size="small"
          icon={<MoreIcon width={24} height={24} aria-hidden="true" />}
          color="neutral"
          variant="tertiary"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const isOpen = !openDropdown;
            setOpenDropdown(isOpen);
            onOpenChange?.(isOpen);
            addLastFocus(e.currentTarget);
            onButtonClick?.(
              e as React.MouseEvent<HTMLButtonElement, MouseEvent>,
            );
          }}
          {...buttonPropsLeft}
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
      {isModalMoveOpen && (
        <DocMoveModal
          doc={doc}
          onClose={() => {
            setIsModalMoveOpen(false);
            restoreFocus();
          }}
          isOpen={isModalMoveOpen}
          onAfterMove={() => treeContext?.setRoot(null)}
        />
      )}
    </>
  );
};

export const DocToolBox = memo(DocToolBoxComponent);
