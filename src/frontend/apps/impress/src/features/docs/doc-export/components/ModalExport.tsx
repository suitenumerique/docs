import { DOCXExporter } from '@blocknote/xl-docx-exporter';
import { ODTExporter } from '@blocknote/xl-odt-exporter';
import { PDFExporter } from '@blocknote/xl-pdf-exporter';
import {
  Button,
  Loader,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { DocumentProps, pdf } from '@react-pdf/renderer';
import jsonemoji from 'emoji-datasource-apple' assert { type: 'json' };
import i18next from 'i18next';
import JSZip from 'jszip';
import { cloneElement, isValidElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, ButtonCloseModal, Text } from '@/components';
import { useMediaUrl } from '@/core';
import { useEditorStore } from '@/docs/doc-editor';
import { Doc, useTrans } from '@/docs/doc-management';
import { fallbackLng } from '@/i18n/config';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { TemplatesOrdering, useTemplates } from '../api/useTemplates';
import { docxDocsSchemaMappings } from '../mappingDocx';
import { odtDocsSchemaMappings } from '../mappingODT';
import { pdfDocsSchemaMappings } from '../mappingPDF';
import {
  addMediaFilesToZip,
  downloadFile,
  generateHtmlDocument,
} from '../utils';

enum DocDownloadFormat {
  HTML = 'html',
  PDF = 'pdf',
  DOCX = 'docx',
  ODT = 'odt',
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
  const mediaUrl = useMediaUrl();

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

    const filename = (doc.title || untitledDocument)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s/g, '-');

    const documentTitle = doc.title || untitledDocument;

    const html = templateSelected;
    let exportDocument = editor.document;
    if (html) {
      const blockTemplate = await editor.tryParseHTMLToBlocks(html);
      exportDocument = [...blockTemplate, ...editor.document];
    }

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

      await addMediaFilesToZip(parsedDocument, zip, mediaUrl);

      const lang = i18next.language || fallbackLng;
      const editorHtmlWithLocalMedia = parsedDocument.body.innerHTML;

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
            aria-label={t('Cancel the download')}
            variant="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            data-testid="doc-export-download-button"
            aria-label={t('Download')}
            variant="primary"
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
            {t('Download')}
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
            'Download your document in a .docx, .odt, .pdf or .html(zip) format.',
          )}
        </Text>
        <Select
          clearable={false}
          fullWidth
          label={t('Format')}
          options={[
            { label: t('Docx'), value: DocDownloadFormat.DOCX },
            { label: t('ODT'), value: DocDownloadFormat.ODT },
            { label: t('PDF'), value: DocDownloadFormat.PDF },
            { label: t('HTML'), value: DocDownloadFormat.HTML },
          ]}
          value={format}
          onChange={(options) =>
            setFormat(options.target.value as DocDownloadFormat)
          }
        />
        <Select
          clearable={false}
          fullWidth
          label={t('Template')}
          options={templateOptions}
          value={templateSelected}
          disabled={format === DocDownloadFormat.HTML}
          onChange={(options) =>
            setTemplateSelected(options.target.value as string)
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
