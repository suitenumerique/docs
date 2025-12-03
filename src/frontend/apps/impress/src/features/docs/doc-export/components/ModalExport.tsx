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
import { useEditorStore } from '@/docs/doc-editor';
import { Doc, useTrans } from '@/docs/doc-management';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { TemplatesOrdering, useTemplates } from '../api/useTemplates';
import { docxDocsSchemaMappings } from '../mappingDocx';
import { odtDocsSchemaMappings } from '../mappingODT';
import { pdfDocsSchemaMappings } from '../mappingPDF';
import { downloadFile, escapeHtml } from '../utils';

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

      const mediaFiles: { filename: string; blob: Blob }[] = [];
      const mediaElements = Array.from(
        parsedDocument.querySelectorAll<
          | HTMLImageElement
          | HTMLVideoElement
          | HTMLAudioElement
          | HTMLSourceElement
        >('img, video, audio, source'),
      );

      await Promise.all(
        mediaElements.map(async (element, index) => {
          const src = element.getAttribute('src');

          if (!src) {
            return;
          }

          const fetched = await exportCorsResolveFileUrl(doc.id, src);

          if (!(fetched instanceof Blob)) {
            return;
          }

          // Derive a readable filename:
          // - data: URLs → use a generic "media-N.ext"
          // - normal URLs → keep the last path segment as base name.
          let baseName = `media-${index + 1}`;

          if (!src.startsWith('data:')) {
            try {
              const url = new URL(src, window.location.origin);
              const lastSegment = url.pathname.split('/').pop();
              if (lastSegment) {
                baseName = `${index + 1}-${lastSegment}`;
              }
            } catch {
              // Ignore invalid URLs, keep default baseName.
            }
          }

          let filename = baseName;

          // Ensure the filename has an extension consistent with the blob MIME type.
          const mimeType = fetched.type;
          if (mimeType && !baseName.includes('.')) {
            const slashIndex = mimeType.indexOf('/');
            const rawSubtype =
              slashIndex !== -1 && slashIndex < mimeType.length - 1
                ? mimeType.slice(slashIndex + 1)
                : '';

            let extension = '';
            const subtype = rawSubtype.toLowerCase();

            if (subtype.includes('svg')) {
              extension = 'svg';
            } else if (subtype.includes('jpeg') || subtype.includes('pjpeg')) {
              extension = 'jpg';
            } else if (subtype.includes('png')) {
              extension = 'png';
            } else if (subtype.includes('gif')) {
              extension = 'gif';
            } else if (subtype.includes('webp')) {
              extension = 'webp';
            } else if (subtype.includes('pdf')) {
              extension = 'pdf';
            } else if (subtype) {
              extension = subtype.split('+')[0];
            }

            if (extension) {
              filename = `${baseName}.${extension}`;
            }
          }

          element.setAttribute('src', filename);
          mediaFiles.push({ filename, blob: fetched });
        }),
      );

      const lang = i18next.language || 'fr';
      const editorHtmlWithLocalMedia = parsedDocument.body.innerHTML;

      const htmlContent = `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
  </head>
  <body>
    <main role="main">
${editorHtmlWithLocalMedia}
    </main>
  </body>
</html>`;

      const zip = new JSZip();
      zip.file('index.html', htmlContent);

      mediaFiles.forEach(({ filename, blob }) => {
        zip.file(filename, blob);
      });

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
