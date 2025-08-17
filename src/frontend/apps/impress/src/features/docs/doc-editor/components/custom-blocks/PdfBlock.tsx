/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import {
  AddFileButton,
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

const PDFBlockStyle = createGlobalStyle`
  .bn-block-content[data-content-type="pdf"] {
    width: fit-content;
  }
`;

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
      const { t } = useTranslation();
      const pdfUrl = block.props.url;

      return (
        <Box ref={contentRef} className="bn-file-block-content-wrapper">
          <PDFBlockStyle />
          <ResizableFileBlockWrapper
            buttonIcon={<Icon iconName="upload" />}
            block={block}
            editor={editor as unknown as FileBlockEditor}
            buttonText={t('Add PDF')}
          >
            <Box
              className="bn-visual-media"
              role="presentation"
              as="embed"
              $width="100%"
              $height="450px"
              type="application/pdf"
              src={pdfUrl}
              contentEditable={false}
              draggable={false}
              onClick={() => editor.setTextCursorPosition(block)}
            />
          </ResizableFileBlockWrapper>
        </Box>
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
    aliases: [t('pdf'), t('document'), t('embed'), t('file')],
    group,
    icon: <Icon iconName="picture_as_pdf" $size="18px" />,
    subtext: t('Embed a PDF file'),
  },
];
