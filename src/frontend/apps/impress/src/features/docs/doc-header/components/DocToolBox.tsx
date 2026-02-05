import {
  Button,
  ButtonElement,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
  IconOptions,
} from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import Export from '@/docs/doc-export/';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  ModalRemoveDoc,
  getEmojiAndTitle,
  useCopyDocLink,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useDocTitleUpdate,
  useDocUtils,
  useDuplicateDoc,
} from '@/docs/doc-management';
import { DocShareModal } from '@/docs/doc-share';
import {
  KEY_LIST_DOC_VERSIONS,
  ModalSelectVersion,
} from '@/docs/doc-versioning';
import { useRestoreFocus } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import { useCopyCurrentEditorToClipboard } from '../hooks/useCopyCurrentEditorToClipboard';

import { BoutonShare } from './BoutonShare';

const ModalExport = Export?.ModalExport;

interface DocToolBoxProps {
  doc: Doc;
}

export const DocToolBox = ({ doc }: DocToolBoxProps) => {
  const { t } = useTranslation();
  const treeContext = useTreeContext<Doc>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isChild, isTopRoot } = useDocUtils(doc);

  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalExportOpen, setIsModalExportOpen] = useState(false);
  const selectHistoryModal = useModal();
  const modalShare = useModal();
  const optionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareButtonRef = useRef<ButtonElement | null>(null);
  const exportButtonRef = useRef<ButtonElement | null>(null);
  const shareTriggerRef = useRef<HTMLElement | null>(null);
  const exportTriggerRef = useRef<HTMLElement | null>(null);
  const historyTriggerRef = useRef<HTMLElement | null>(null);
  const removeTriggerRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRestoreFocus();

  const { isSmallMobile, isMobile } = useResponsiveStore();
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

  useEffect(() => {
    if (selectHistoryModal.isOpen) {
      return;
    }

    void queryClient.resetQueries({
      queryKey: [KEY_LIST_DOC_VERSIONS],
    });
  }, [selectHistoryModal.isOpen, queryClient]);

  // Emoji Management
  const { emoji } = getEmojiAndTitle(doc.title ?? '');
  const { updateDocEmoji } = useDocTitleUpdate();

  const options: DropdownMenuOption[] = [
    {
      label: t('Share'),
      icon: 'group',
      callback: () => {
        shareTriggerRef.current = optionsButtonRef.current;
        modalShare.open();
      },
      show: isSmallMobile,
    },
    {
      label: t('Export'),
      icon: 'download',
      callback: () => {
        exportTriggerRef.current = optionsButtonRef.current;
        setIsModalExportOpen(true);
      },
      show: !!ModalExport && isSmallMobile,
    },
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
      testId: `docs-actions-${doc.is_favorite ? 'unpin' : 'pin'}-${doc.id}`,
    },
    {
      label: t('Version history'),
      icon: 'history',
      disabled: !doc.abilities.versions_list,
      callback: () => {
        historyTriggerRef.current = optionsButtonRef.current;
        selectHistoryModal.open();
      },
      show: !isMobile,
      showSeparator: isTopRoot ? true : false,
    },
    {
      label: t('Remove emoji'),
      icon: 'emoji_emotions',
      callback: () => {
        updateDocEmoji(doc.id, doc.title ?? '', '');
      },
      showSeparator: true,
      show: !!emoji && doc.abilities.partial_update && !isTopRoot,
    },
    {
      label: t('Add emoji'),
      icon: 'emoji_emotions',
      callback: () => {
        updateDocEmoji(doc.id, doc.title ?? '', '📄');
      },
      showSeparator: true,
      show: !emoji && doc.abilities.partial_update && !isTopRoot,
    },
    {
      label: t('Copy link'),
      icon: 'add_link',
      callback: copyDocLink,
    },
    {
      label: t('Copy as {{format}}', { format: 'Markdown' }),
      icon: 'content_copy',
      callback: () => {
        void copyCurrentEditorToClipboard('markdown');
      },
      showSeparator: true,
    },
    {
      label: t('Duplicate'),
      icon: 'content_copy',
      disabled: !doc.abilities.duplicate,
      callback: () => {
        duplicateDoc({
          docId: doc.id,
          with_accesses: false,
          canSave: doc.abilities.partial_update,
        });
      },
      showSeparator: true,
    },
    {
      label: isChild ? t('Delete sub-document') : t('Delete document'),
      icon: 'delete',
      disabled: !doc.abilities.destroy,
      callback: () => {
        removeTriggerRef.current = optionsButtonRef.current;
        setIsModalRemoveOpen(true);
      },
    },
  ];

  const copyCurrentEditorToClipboard = useCopyCurrentEditorToClipboard();

  return (
    <Box
      $margin={{ left: 'auto' }}
      $direction="row"
      $align="center"
      $gap="0.5rem 1.5rem"
      $wrap={isSmallMobile ? 'wrap' : 'nowrap'}
      className="--docs--doc-toolbox"
    >
      <Box
        $direction="row"
        $align="center"
        $margin={{ left: 'auto' }}
        $gap={spacingsTokens['2xs']}
      >
        <BoutonShare
          doc={doc}
          open={() => {
            shareTriggerRef.current = shareButtonRef.current;
            modalShare.open();
          }}
          isHidden={isSmallMobile}
          displayNbAccess={doc.abilities.accesses_view}
          buttonRef={shareButtonRef}
        />

        {!isSmallMobile && ModalExport && (
          <Button
            ref={exportButtonRef}
            data-testid="doc-open-modal-download-button"
            variant="tertiary"
            icon={
              <Icon iconName="download" $color="inherit" aria-hidden={true} />
            }
            onClick={() => {
              exportTriggerRef.current = exportButtonRef.current;
              setIsModalExportOpen(true);
            }}
            size={isSmallMobile ? 'small' : 'medium'}
            aria-label={t('Export the document')}
          />
        )}
        <DropdownMenu
          options={options}
          label={t('Open the document options')}
          buttonRef={optionsButtonRef}
          buttonCss={css`
            padding: ${spacingsTokens['xs']};
            ${isSmallMobile
              ? css`
                  border: 1px solid ${colorsTokens['gray-300']};
                `
              : ''}
          `}
        >
          <IconOptions aria-hidden="true" isHorizontal $color="inherit" />
        </DropdownMenu>
      </Box>

      {modalShare.isOpen && (
        <DocShareModal
          onClose={() => {
            modalShare.close();
            restoreFocus(
              shareTriggerRef.current ??
                shareButtonRef.current ??
                optionsButtonRef.current,
            );
          }}
          doc={doc}
          isRootDoc={treeContext?.root?.id === doc.id}
        />
      )}
      {isModalExportOpen && ModalExport && (
        <ModalExport
          onClose={() => {
            setIsModalExportOpen(false);
            restoreFocus(
              exportTriggerRef.current ??
                exportButtonRef.current ??
                optionsButtonRef.current,
            );
          }}
          doc={doc}
        />
      )}
      {isModalRemoveOpen && (
        <ModalRemoveDoc
          onClose={() => {
            setIsModalRemoveOpen(false);
            restoreFocus(removeTriggerRef.current ?? optionsButtonRef.current);
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
            restoreFocus(historyTriggerRef.current ?? optionsButtonRef.current);
          }}
          doc={doc}
        />
      )}
    </Box>
  );
};
