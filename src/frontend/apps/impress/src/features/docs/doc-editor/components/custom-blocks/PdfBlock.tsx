/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import {
  AddFileButton,
  FileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Box, Icon } from '@/components';
import { useResponsiveStore } from '@/stores';

import { DocsBlockNoteEditor } from '../../types';

type FileBlockEditor = Parameters<typeof AddFileButton>[0]['editor'];

export const PdfBlock = createReactBlockSpec(
  {
    type: 'pdf',
    content: 'none',
    propSchema: {
      name: { default: '' as const },
      url: { default: '' as const },
      caption: { default: '' as const },
      showPreview: { default: true },
      previewWidth: { default: undefined, type: 'number' },
    },
    isFileBlock: true,
    fileBlockAccept: ['application/pdf'],
  },
  {
    render: ({ editor, block, contentRef }) => {
      const pdfUrl = block.props.url;

      const { t } = useTranslation();

      const { isMobile } = useResponsiveStore();

      return (
        <div ref={contentRef} className="bn-file-block-content-wrapper">
          {pdfUrl === '' ? (
            <AddFileButton
              block={block}
              editor={editor as unknown as FileBlockEditor}
              buttonText={t('Add PDF')}
              buttonIcon={<Icon iconName="upload" />}
            />
          ) : (
            <FileBlockWrapper
              block={block}
              editor={editor as unknown as FileBlockEditor}
            >
              {isMobile ? (
                <Box
                  $display="flex"
                  $align="center"
                  $justify="center"
                  $direction="row"
                  $gap="1rem"
                >
                  <Icon iconName="picture_as_pdf" $size="18px" />
                  <Box
                    as="p"
                    $display="inline-block"
                    style={{
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      display: 'inline',
                    }}
                  >
                    {block.props.name}
                  </Box>
                </Box>
              ) : (
                <Box $width="100%" $position="relative">
                  <Box
                    $width={`${block.props.previewWidth ?? 100}%`}
                    $height="500px"
                    $position="relative"
                    $css={`
                    border: 1px solid #ccc;
                    margin: auto;
                  `}
                  >
                    <embed
                      src={pdfUrl}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                      contentEditable={false}
                      draggable={false}
                      onClick={() => editor.setTextCursorPosition(block)}
                    />
                  </Box>
                </Box>
              )}
            </FileBlockWrapper>
          )}
        </div>
      );
    },
  },
);

export const getPdfReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('PDF'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, { type: 'pdf' });
    },
    aliases: ['pdf', 'document', 'embed', 'file'],
    group,
    icon: <Icon iconName="picture_as_pdf" $size="18px" />,
    subtext: t('Embed a PDF file'),
  },
];
