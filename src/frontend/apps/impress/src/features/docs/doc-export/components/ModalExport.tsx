import { DOCXExporter } from '@blocknote/xl-docx-exporter';
import { ODTExporter } from '@blocknote/xl-odt-exporter';
import { PDFExporter } from '@blocknote/xl-pdf-exporter';
import {
  Button,
  ButtonElement,
  Loader,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { DocumentProps, pdf } from '@react-pdf/renderer';
import jsonemoji from 'emoji-datasource-apple' assert { type: 'json' };
import i18next from 'i18next';
import JSZip from 'jszip';
import { cloneElement, isValidElement, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, ButtonCloseModal, Text } from '@/components';
import { useMediaUrl } from '@/core';
import { useEditorStore } from '@/docs/doc-editor';
import { Doc, useTrans } from '@/docs/doc-management';
import { useFocusOnMount } from '@/hooks';
import { fallbackLng } from '@/i18n/config';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { docxDocsSchemaMappings } from '../mappingDocx';
import { odtDocsSchemaMappings } from '../mappingODT';
import { pdfDocsSchemaMappings } from '../mappingPDF';
import { downloadFile } from '../utils';
import {
  addMediaFilesToZip,
  generateHtmlDocument,
  improveHtmlAccessibility,
} from '../utils_html';
import { printDocumentWithStyles } from '../utils_print';

enum DocDownloadFormat {
  HTML = 'html',
  PDF = 'pdf',
  DOCX = 'docx',
  ODT = 'odt',
  PRINT = 'print',
}

interface ModalExportProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalExport = ({ onClose, doc }: ModalExportProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { editor } = useEditorStore();
  const cancelButtonRef = useRef<ButtonElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<DocDownloadFormat>(
    DocDownloadFormat.PDF,
  );
  const { untitledDocument } = useTrans();
  const mediaUrl = useMediaUrl();

  useFocusOnMount(cancelButtonRef);

  async function onSubmit() {
    if (!editor) {
      toast(t('The export failed'), VariantType.ERROR);
      return;
    }

    setIsExporting(true);

    // Handle print separately as it doesn't download a file
    if (format === DocDownloadFormat.PRINT) {
      printDocumentWithStyles();
      setIsExporting(false);
      onClose();
      return;
    }

    const filename = (doc.title || untitledDocument)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s/g, '-');

    const documentTitle = doc.title || untitledDocument;

    const exportDocument = editor.document;
    let blobExport: Blob;
    if (format === DocDownloadFormat.PDF) {
      const exporter = new PDFExporter(editor.schema, pdfDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        emojiSource: {
          format: 'png',
          builder(code) {
            const emoji = jsonemoji.find((e) =>
              e.unified.toLocaleLowerCase().includes(code.toLowerCase()),
            );

            if (emoji) {
              return `/assets/fonts/emoji/${emoji.image}`;
            }

            return '/assets/fonts/emoji/fallback.png';
          },
        },
      });
      const rawPdfDocument = (await exporter.toReactPDFDocument(
        exportDocument,
      )) as React.ReactElement<DocumentProps>;

      // Add language, title and outline properties to improve PDF accessibility and navigation
      const pdfDocument = isValidElement(rawPdfDocument)
        ? cloneElement(rawPdfDocument, {
            language: i18next.language,
            title: documentTitle,
            pageMode: 'useOutlines',
          })
        : rawPdfDocument;

      blobExport = await pdf(pdfDocument).toBlob();
    } else if (format === DocDownloadFormat.DOCX) {
      const exporter = new DOCXExporter(editor.schema, docxDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
      });

      blobExport = await exporter.toBlob(exportDocument, {
        documentOptions: { title: documentTitle },
        sectionOptions: {},
      });
    } else if (format === DocDownloadFormat.ODT) {
      const exporter = new ODTExporter(editor.schema, odtDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
      });

      blobExport = await exporter.toODTDocument(exportDocument);
    } else if (format === DocDownloadFormat.HTML) {
      // Use BlockNote "full HTML" export so that we stay closer to the editor rendering.
      const fullHtml = await editor.blocksToFullHTML();

      // Parse HTML and fetch media so that we can package a fully offline HTML document in a ZIP.
      const domParser = new DOMParser();
      const parsedDocument = domParser.parseFromString(fullHtml, 'text/html');

      const zip = new JSZip();

      improveHtmlAccessibility(parsedDocument, documentTitle);
      await addMediaFilesToZip(parsedDocument, zip, mediaUrl);

      const lang = i18next.language || fallbackLng;
      const body = parsedDocument.body;
      const editorHtmlWithLocalMedia = body ? body.innerHTML : '';

      const htmlContent = generateHtmlDocument(
        documentTitle,
        editorHtmlWithLocalMedia,
        lang,
      );

      zip.file('index.html', htmlContent);

      // CSS Styles
      const cssResponse = await fetch(
        new URL('../assets/export-html-styles.txt', import.meta.url).toString(),
      );
      const cssContent = await cssResponse.text();
      zip.file('styles.css', cssContent);

      blobExport = await zip.generateAsync({ type: 'blob' });
    } else {
      toast(t('The export failed'), VariantType.ERROR);
      setIsExporting(false);
      return;
    }

    const downloadExtension =
      format === DocDownloadFormat.HTML ? 'zip' : format;

    downloadFile(blobExport, `${filename}.${downloadExtension}`);

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
      hideCloseButton
      aria-describedby="modal-export-title"
      rightActions={
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={t('Cancel the download')}
            variant="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            data-testid="doc-export-download-button"
            aria-label={
              format === DocDownloadFormat.PRINT ? t('Print') : t('Download')
            }
            variant="primary"
            fullWidth
            onClick={() => void onSubmit()}
            disabled={isExporting}
          >
            {format === DocDownloadFormat.PRINT ? t('Print') : t('Download')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $width="100%"
        >
          <Text
            as="h1"
            $margin="0"
            id="modal-export-title"
            $size="h6"
            $align="flex-start"
            data-testid="modal-export-title"
          >
            {t('Export')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the download modal')}
            onClick={() => onClose()}
            disabled={isExporting}
          />
        </Box>
      }
    >
      <Box
        $margin={{ bottom: 'xl' }}
        aria-label={t('Content modal to export the document')}
        $gap="1rem"
        className="--docs--modal-export-content"
      >
        <Text $variation="secondary" $size="sm" as="p">
          {t(
            'Export your document to print or download in .docx, .odt, .pdf or .html(zip) format.',
          )}
        </Text>
        <Select
          clearable={false}
          fullWidth
          label={t('Format')}
          options={[
            { label: t('PDF'), value: DocDownloadFormat.PDF },
            { label: t('Docx'), value: DocDownloadFormat.DOCX },
            { label: t('ODT'), value: DocDownloadFormat.ODT },
            { label: t('HTML'), value: DocDownloadFormat.HTML },
            { label: t('Print'), value: DocDownloadFormat.PRINT },
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
