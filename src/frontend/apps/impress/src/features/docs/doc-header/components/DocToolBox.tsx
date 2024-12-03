import {
  Button,
  VariantType,
  useModal,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
  IconOptions,
} from '@/components';
import { useAuthStore } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import {
  useEditorStore,
  usePanelEditorStore,
} from '@/features/docs/doc-editor/';
import {
  Doc,
  ModalRemoveDoc,
  ModalShare,
} from '@/features/docs/doc-management';
import { ModalSelectVersion } from '@/features/docs/doc-versioning';
import { useResponsiveStore } from '@/stores';

import { ModalPDF } from './ModalExport';

interface DocToolBoxProps {
  doc: Doc;
}

export const DocToolBox = ({ doc }: DocToolBoxProps) => {
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const spacings = spacingsTokens();
  const colors = colorsTokens();

  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalPDFOpen, setIsModalPDFOpen] = useState(false);
  const selectHistoryModal = useModal();
  const { setIsPanelOpen, setIsPanelTableContentOpen } = usePanelEditorStore();

  const { isSmallMobile, isDesktop } = useResponsiveStore();
  const { authenticated } = useAuthStore();
  const { editor } = useEditorStore();
  const { toast } = useToastProvider();

  const options: DropdownMenuOption[] = [
    ...(isSmallMobile
      ? [
          {
            label: t('Share'),
            icon: 'upload',
            callback: () => {
              setIsModalShareOpen(true);
            },
          },
          {
            label: t('Export'),
            icon: 'download',
            callback: () => {
              setIsModalPDFOpen(true);
            },
          },
        ]
      : []),
    {
      label: t('Version history'),
      icon: 'history',
      disabled: !doc.abilities.versions_list,
      callback: () => {
        selectHistoryModal.open();
      },
      show: isDesktop,
    },
    {
      label: t('Table of contents'),
      icon: 'summarize',
      callback: () => {
        setIsPanelOpen(true);
        setIsPanelTableContentOpen(true);
      },
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

  const copyCurrentEditorToClipboard = async (
    asFormat: 'html' | 'markdown',
  ) => {
    if (!editor) {
      toast(t('Editor unavailable'), VariantType.ERROR, { duration: 3000 });
      return;
    }

    try {
      const editorContentFormatted =
        asFormat === 'html'
          ? await editor.blocksToHTMLLossy()
          : await editor.blocksToMarkdownLossy();
      await navigator.clipboard.writeText(editorContentFormatted);
      toast(t('Copied to clipboard'), VariantType.SUCCESS, { duration: 3000 });
    } catch (error) {
      console.error(error);
      toast(t('Failed to copy to clipboard'), VariantType.ERROR, {
        duration: 3000,
      });
    }
  };

  return (
    <Box
      $margin={{ left: 'auto' }}
      $direction="row"
      $align="center"
      $gap="0.5rem 1.5rem"
      $wrap={isSmallMobile ? 'wrap' : 'nowrap'}
    >
      <Box $direction="row" $margin={{ left: 'auto' }} $gap={spacings['2xs']}>
        {authenticated && !isSmallMobile && (
          <Button
            color="primary-text"
            onClick={() => {
              setIsModalShareOpen(true);
            }}
            size={isSmallMobile ? 'small' : 'medium'}
          >
            {t('Share')}
          </Button>
        )}
        {!isSmallMobile && (
          <Button
            color="primary-text"
            icon={
              <Icon iconName="download" $theme="primary" $variation="800" />
            }
            onClick={() => {
              setIsModalPDFOpen(true);
            }}
            size={isSmallMobile ? 'small' : 'medium'}
          />
        )}
        <DropdownMenu options={options}>
          <IconOptions
            isHorizontal
            $theme="primary"
            $radius={spacings['3xs']}
            $css={
              isSmallMobile
                ? css`
                    padding: 10px;
                    border: 1px solid ${colors['greyscale-300']};
                  `
                : ''
            }
            aria-label={t('Open the document options')}
          />
        </DropdownMenu>
      </Box>
      {isModalShareOpen && (
        <ModalShare onClose={() => setIsModalShareOpen(false)} doc={doc} />
      )}
      {isModalPDFOpen && (
        <ModalPDF onClose={() => setIsModalPDFOpen(false)} doc={doc} />
      )}
      {isModalRemoveOpen && (
        <ModalRemoveDoc onClose={() => setIsModalRemoveOpen(false)} doc={doc} />
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
