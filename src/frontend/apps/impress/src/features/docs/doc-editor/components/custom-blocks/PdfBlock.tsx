import {
  BlockConfig,
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import * as locales from '@blocknote/core/locales';
import {
  AddFileButton,
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, Icon, Loading } from '@/components';

import { ANALYZE_URL } from '../../conf';
import { DocsBlockNoteEditor } from '../../types';

const PDFBlockStyle = createGlobalStyle`
  .bn-block-content[data-content-type="pdf"] .bn-file-block-content-wrapper[style*="fit-content"] {
    width: 100% !important;
  }
`;

type FileBlockEditor = Parameters<typeof AddFileButton>[0]['editor'];
type FileBlockBlock = Parameters<typeof AddFileButton>[0]['block'];

type CreatePDFBlockConfig = BlockConfig<
  'pdf',
  {
    backgroundColor: { default: 'default' };
    caption: { default: '' };
    name: { default: '' };
    previewWidth: { default: undefined; type: 'number' };
    showPreview: { default: true };
    textAlignment: { default: 'left' };
    url: { default: '' };
  },
  'none'
>;

interface PdfBlockComponentProps {
  block: BlockNoDefaults<
    Record<'pdf', CreatePDFBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  contentRef: (node: HTMLElement | null) => void;
  editor: BlockNoteEditor<
    Record<'pdf', CreatePDFBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const PdfBlockComponent = ({
  editor,
  block,
  contentRef,
}: PdfBlockComponentProps) => {
  const pdfUrl = block.props.url;
  const { i18n, t } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const [isPDFContent, setIsPDFContent] = useState<boolean | null>(null);
  const [isPDFContentLoading, setIsPDFContentLoading] =
    useState<boolean>(false);

  useEffect(() => {
    if (lang && locales[lang as keyof typeof locales]) {
      locales[lang as keyof typeof locales].file_blocks.add_button_text['pdf'] =
        t('Add PDF');
      (
        locales[lang as keyof typeof locales].file_panel.embed
          .embed_button as Record<string, string>
      )['pdf'] = t('Add PDF');
      (
        locales[lang as keyof typeof locales].file_panel.upload
          .file_placeholder as Record<string, string>
      )['pdf'] = t('Upload PDF');
    }
  }, [lang, t]);

  useEffect(() => {
    if (!pdfUrl || pdfUrl.includes(ANALYZE_URL)) {
      return;
    }

    const validatePDFContent = async () => {
      setIsPDFContentLoading(true);
      try {
        const response = await fetch(pdfUrl, {
          credentials: 'include',
        });
        const contentType = response.headers.get('content-type');

        if (response.ok && contentType?.includes('application/pdf')) {
          setIsPDFContent(true);
        } else {
          setIsPDFContent(false);
        }
      } catch {
        setIsPDFContent(false);
      } finally {
        setIsPDFContentLoading(false);
      }
    };

    void validatePDFContent();
  }, [pdfUrl]);

  return (
    <Box ref={contentRef} className="bn-file-block-content-wrapper">
      <PDFBlockStyle />
      {isPDFContentLoading && <Loading />}
      {!isPDFContentLoading && isPDFContent !== null && !isPDFContent && (
        <Box
          $align="center"
          $justify="center"
          $color="#666"
          $background="#f5f5f5"
          $border="1px solid #ddd"
          $height="300px"
          $css={css`
            text-align: center;
          `}
          contentEditable={false}
          onClick={() => editor.setTextCursorPosition(block)}
        >
          {t('Invalid or missing PDF file.')}
        </Box>
      )}
      <ResizableFileBlockWrapper
        buttonIcon={
          <Icon iconName="upload" $size="24px" $css="line-height: normal;" />
        }
        block={block as unknown as FileBlockBlock}
        editor={editor as unknown as FileBlockEditor}
      >
        {!isPDFContentLoading && isPDFContent && (
          <Box
            as="embed"
            className="bn-visual-media"
            role="presentation"
            $width="100%"
            $height="450px"
            type="application/pdf"
            src={pdfUrl}
            aria-label={block.props.name || t('PDF document')}
            contentEditable={false}
            draggable={false}
            onClick={() => editor.setTextCursorPosition(block)}
          />
        )}
      </ResizableFileBlockWrapper>
    </Box>
  );
};

export const PdfBlock = createReactBlockSpec(
  {
    type: 'pdf',
    content: 'none',
    propSchema: {
      backgroundColor: { default: 'default' as const },
      caption: { default: '' as const },
      name: { default: '' as const },
      previewWidth: { default: undefined, type: 'number' },
      showPreview: { default: true },
      textAlignment: { default: 'left' as const },
      url: { default: '' as const },
    },
  },
  {
    meta: {
      fileBlockAccept: ['application/pdf'],
    },
    render: (props) => <PdfBlockComponent {...props} />,
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
      insertOrUpdateBlockForSlashMenu(editor, { type: 'pdf' });
    },
    aliases: [t('pdf'), t('document'), t('embed'), t('file')],
    group,
    icon: <Icon iconName="picture_as_pdf" $size="18px" />,
    subtext: t('Embed a PDF file'),
  },
];
