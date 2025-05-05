import { useModal } from '@openfun/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, IconOptions } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  ModalRemoveDoc,
  useCopyDocLink,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
} from '@/docs/doc-management';
import {
  KEY_LIST_DOC_VERSIONS,
  ModalSelectVersion,
} from '@/docs/doc-versioning';
import { useAnalytics } from '@/libs';
import { useResponsiveStore } from '@/stores';

import { DocShareModal } from '../../doc-share';
import { useCopyCurrentEditorToClipboard } from '../hooks/useCopyCurrentEditorToClipboard';

type ModalType = ReturnType<typeof useModal>;

interface DocToolBoxLicenceProps {
  doc: Doc;
  modalHistory: ModalType;
  modalShare: ModalType;
}

export const DocToolBoxLicenceMIT = ({
  doc,
  modalHistory,
  modalShare,
}: DocToolBoxLicenceProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { colorsTokens } = useCunninghamTheme();

  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);

  const { isSmallMobile, isDesktop } = useResponsiveStore();
  const copyDocLink = useCopyDocLink(doc.id);
  const { isFeatureFlagActivated } = useAnalytics();
  const removeFavoriteDoc = useDeleteFavoriteDoc({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });
  const makeFavoriteDoc = useCreateFavoriteDoc({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });
  const copyCurrentEditorToClipboard = useCopyCurrentEditorToClipboard();

  const options: DropdownMenuOption[] = [
    ...(isSmallMobile
      ? [
          {
            label: t('Share'),
            icon: 'group',
            callback: modalShare.open,
          },
          {
            label: t('Copy link'),
            icon: 'add_link',
            callback: copyDocLink,
          },
        ]
      : []),
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
        modalHistory.open();
      },
      show: isDesktop,
    },

    {
      label: t('Copy as {{format}}', { format: 'Markdown' }),
      icon: 'content_copy',
      callback: () => {
        void copyCurrentEditorToClipboard('markdown');
      },
    },
    {
      label: t('Copy as {{format}}', { format: 'HTML' }),
      icon: 'content_copy',
      callback: () => {
        void copyCurrentEditorToClipboard('html');
      },
      show: isFeatureFlagActivated('CopyAsHTML'),
    },
    {
      label: t('Delete document'),
      icon: 'delete',
      disabled: !doc.abilities.destroy,
      callback: () => {
        setIsModalRemoveOpen(true);
      },
    },
  ];

  useEffect(() => {
    if (modalHistory.isOpen) {
      return;
    }

    void queryClient.resetQueries({
      queryKey: [KEY_LIST_DOC_VERSIONS],
    });
  }, [modalHistory.isOpen, queryClient]);

  return (
    <>
      <DropdownMenu options={options}>
        <IconOptions
          isHorizontal
          $theme="primary"
          $padding={{ all: 'xs' }}
          $css={css`
            border-radius: 4px;
            &:hover {
              background-color: ${colorsTokens['greyscale-100']};
            }
            ${isSmallMobile
              ? css`
                  padding: 10px;
                  border: 1px solid ${colorsTokens['greyscale-300']};
                `
              : ''}
          `}
          aria-label={t('Open the document options')}
        />
      </DropdownMenu>

      {modalShare.isOpen && (
        <DocShareModal onClose={() => modalShare.close()} doc={doc} />
      )}
      {isModalRemoveOpen && (
        <ModalRemoveDoc onClose={() => setIsModalRemoveOpen(false)} doc={doc} />
      )}
      {modalHistory.isOpen && (
        <ModalSelectVersion onClose={() => modalHistory.close()} doc={doc} />
      )}
    </>
  );
};
