import {
  DOCXExporter,
  docxDefaultSchemaMappings,
} from '@blocknote/xl-docx-exporter';
import {
  PDFExporter,
  pdfDefaultSchemaMappings,
} from '@blocknote/xl-pdf-exporter';
import {
  Button,
  Loader,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { Text as PDFText, pdf } from '@react-pdf/renderer';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useEditorStore } from '@/features/docs/doc-editor';
import { Doc, useTrans } from '@/features/docs/doc-management';

import { TemplatesOrdering, useTemplates } from '../api/useTemplates';
import { downloadFile, exportResolveFileUrl } from '../utils';

import { Table } from './blocks/Table';

enum DocDownloadFormat {
  PDF = 'pdf',
  DOCX = 'docx',
}

interface ModalExportProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalExport = ({ onClose, doc }: ModalExportProps) => {
  const { t } = useTranslation();
  const { data: templates } = useTemplates({
    ordering: TemplatesOrdering.BY_CREATED_ON_DESC,
  });
  const { toast } = useToastProvider();
  const { editor } = useEditorStore();
  const [templateSelected, setTemplateSelected] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<DocDownloadFormat>(
    DocDownloadFormat.PDF,
  );
  const { untitledDocument } = useTrans();

  const templateOptions = useMemo(() => {
    const templateOptions = (templates?.pages || [])
      .map((page) =>
        page.results.map((template) => ({
          label: template.title,
          value: template.code,
        })),
      )
      .flat();

    templateOptions.unshift({
      label: t('Empty template'),
      value: '',
    });

    return templateOptions;
  }, [t, templates?.pages]);

  async function onSubmit() {
    if (!editor) {
      toast(t('The export failed'), VariantType.ERROR);
      return;
    }

    setIsExporting(true);

    const title = (doc.title || untitledDocument)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s/g, '-');

    const html = templateSelected;
    let exportDocument = editor.document;
    if (html) {
      const blockTemplate = await editor.tryParseHTMLToBlocks(html);
      exportDocument = [...blockTemplate, ...editor.document];
    }

    let blobExport: Blob;
    if (format === DocDownloadFormat.PDF) {
      const defaultExporter = new PDFExporter(
        editor.schema,
        pdfDefaultSchemaMappings,
      );

      const exporter = new PDFExporter(
        editor.schema,
        {
          ...pdfDefaultSchemaMappings,
          blockMapping: {
            ...pdfDefaultSchemaMappings.blockMapping,
            heading: (block, exporter) => {
              const PIXELS_PER_POINT = 0.75;
              const MERGE_RATIO = 7.5;
              const FONT_SIZE = 16;
              const fontSizeEM =
                block.props.level === 1
                  ? 2
                  : block.props.level === 2
                    ? 1.5
                    : 1.17;
              return (
                <PDFText
                  key={block.id}
                  style={{
                    fontSize: fontSizeEM * FONT_SIZE * PIXELS_PER_POINT,
                    fontWeight: 700,
                    marginTop: `${fontSizeEM * MERGE_RATIO}px`,
                    marginBottom: `${fontSizeEM * MERGE_RATIO}px`,
                  }}
                >
                  {exporter.transformInlineContent(block.content)}
                </PDFText>
              );
            },
            paragraph: (block, exporter) => {
              /**
               * Breakline in the editor are not rendered in the PDF
               * By adding a space if the block is empty we ensure that the block is rendered
               */
              if (Array.isArray(block.content)) {
                block.content.forEach((content) => {
                  if (content.type === 'text' && !content.text) {
                    content.text = ' ';
                  }
                });

                if (!block.content.length) {
                  block.content.push({
                    styles: {},
                    text: ' ',
                    type: 'text',
                  });
                }
              }
              return (
                <PDFText key={block.id}>
                  {exporter.transformInlineContent(block.content)}
                </PDFText>
              );
            },
            table: (block, transformer) => {
              return <Table data={block.content} transformer={transformer} />;
            },
          },
        },
        {
          resolveFileUrl: async (url) =>
            exportResolveFileUrl(url, defaultExporter.options.resolveFileUrl),
        },
      );
      const pdfDocument = await exporter.toReactPDFDocument(exportDocument);
      blobExport = await pdf(pdfDocument).toBlob();
    } else {
      const defaultExporter = new DOCXExporter(
        editor.schema,
        docxDefaultSchemaMappings,
      );

      const exporter = new DOCXExporter(
        editor.schema,
        docxDefaultSchemaMappings,
        {
          resolveFileUrl: async (url) =>
            exportResolveFileUrl(url, defaultExporter.options.resolveFileUrl),
        },
      );

      blobExport = await exporter.toBlob(exportDocument);
    }

    downloadFile(blobExport, `${title}.${format}`);

    toast(
      t('Your {{format}} was downloaded succesfully', {
        format,
      }),
      VariantType.SUCCESS,
    );

    setIsExporting(false);

    onClose();
  }

  return (
    <Modal
      data-testid="modal-export"
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      rightActions={
        <>
          <Button
            aria-label={t('Close the modal')}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
            disabled={isExporting}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Download')}
            color="primary"
            fullWidth
            onClick={() => void onSubmit()}
            disabled={isExporting}
          >
            {t('Download')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Text $size="h6" $variation="1000" $align="flex-start">
          {t('Download')}
        </Text>
      }
    >
      <Box
        $margin={{ bottom: 'xl' }}
        aria-label={t('Content modal to export the document')}
        $gap="1rem"
      >
        <Text $variation="600" $size="sm">
          {t('Download your document in a .docx or .pdf format.')}
        </Text>
        <Select
          clearable={false}
          label={t('Template')}
          options={templateOptions}
          value={templateSelected}
          onChange={(options) =>
            setTemplateSelected(options.target.value as string)
          }
        />
        <Select
          clearable={false}
          fullWidth
          label={t('Format')}
          options={[
            { label: t('Docx'), value: DocDownloadFormat.DOCX },
            { label: t('PDF'), value: DocDownloadFormat.PDF },
          ]}
          value={format}
          onChange={(options) =>
            setFormat(options.target.value as DocDownloadFormat)
          }
        />

        {isExporting && (
          <Box
            $align="center"
            $margin={{ top: 'big' }}
            $css={css`
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -100%);
            `}
          >
            <Loader />
          </Box>
        )}
      </Box>
    </Modal>
  );
};
