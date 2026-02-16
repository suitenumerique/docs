import { Button, useModal } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
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
  ModalEncryptDoc,
  ModalRemoveDoc,
  ModalRemoveDocEncryption,
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
import { useResponsiveStore } from '@/stores';

import { useCopyCurrentEditorToClipboard } from '../hooks/useCopyCurrentEditorToClipboard';

import { BoutonShare } from './BoutonShare';

const ModalExport = Export?.ModalExport;

interface DocToolBoxProps {
  doc: Doc;
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null;
}

export const DocToolBox = ({ doc, encryptionSettings }: DocToolBoxProps) => {
  const { t } = useTranslation();
  const treeContext = useTreeContext<Doc>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isChild, isTopRoot } = useDocUtils(doc);

  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalExportOpen, setIsModalExportOpen] = useState(false);
  const [isModalEncryptOpen, setIsModalEncryptOpen] = useState(false);
  const [isModalRemoveEncryptionOpen, setIsModalRemoveEncryptionOpen] =
    useState(false);
  const selectHistoryModal = useModal();
  const modalShare = useModal();

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
      callback: modalShare.open,
      show: isSmallMobile,
    },
    {
      label: t('Export'),
      icon: 'download',
      callback: () => {
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
        selectHistoryModal.open();
      },
      show: !isMobile,
      showSeparator: isTopRoot ? true : false,
    },
    {
      label: t('Encrypt document'),
      icon: 'https',
      disabled: !doc.abilities.accesses_manage,
      callback: () => {
        setIsModalEncryptOpen(true);
      },
      show: !doc.is_encrypted && doc.abilities.update,
      showSeparator: isTopRoot ? true : false,
    },
    {
      label: t('Remove document encryption'),
      icon: 'no_encryption',
      disabled: !doc.abilities.accesses_manage,
      callback: () => {
        setIsModalRemoveEncryptionOpen(true);
      },
      show: doc.is_encrypted && doc.abilities.update,
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
        {doc.is_encrypted && (
          <>
            [chiffrement activé]
            {/* TODO */}
          </>
        )}

        <BoutonShare
          doc={doc}
          open={modalShare.open}
          isHidden={isSmallMobile}
          displayNbAccess={doc.abilities.accesses_view}
        />

        {!isSmallMobile && ModalExport && (
          <Button
            data-testid="doc-open-modal-download-button"
            variant="tertiary"
            icon={
              <Icon iconName="download" $color="inherit" aria-hidden={true} />
            }
            onClick={() => {
              setIsModalExportOpen(true);
            }}
            size={isSmallMobile ? 'small' : 'medium'}
            aria-label={t('Export the document')}
          />
        )}

        <DropdownMenu
          options={options}
          label={t('Open the document options')}
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
          onClose={() => modalShare.close()}
          doc={doc}
          isRootDoc={treeContext?.root?.id === doc.id}
        />
      )}
      {isModalExportOpen && ModalExport && (
        <ModalExport onClose={() => setIsModalExportOpen(false)} doc={doc} />
      )}
      {isModalRemoveOpen && (
        <ModalRemoveDoc
          onClose={() => setIsModalRemoveOpen(false)}
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
      {isModalEncryptOpen && (
        <ModalEncryptDoc
          doc={doc}
          encryptionSettings={encryptionSettings}
          onClose={() => setIsModalEncryptOpen(false)}
          onSuccess={() => {
            //
            // TODO: probably it should make an hard refresh to get the setup
            // but it should before register content in database with accesses, and broadcast the information through websocket
            //
          }}
        />
      )}
      {isModalRemoveEncryptionOpen && (
        <ModalRemoveDocEncryption
          doc={doc}
          onClose={() => setIsModalRemoveEncryptionOpen(false)}
          onSuccess={() => {
            //
            // TODO: probably it should make an hard refresh to get the setup
            // but it should before register content in database with clean accesses, and broadcast the information through websocket
            //
          }}
        />
      )}
      {selectHistoryModal.isOpen && (
        <ModalSelectVersion
          onClose={() => selectHistoryModal.close()}
          doc={doc}
        />
      )}
    </Box>
  );
};
