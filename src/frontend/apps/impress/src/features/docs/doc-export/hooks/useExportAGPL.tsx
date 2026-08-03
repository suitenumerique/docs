/**
 * This exports modules are AGPL licensed and should only
 * be used when the application is not published as MIT.
 */
import { DOCXExporter } from '@blocknote/xl-docx-exporter';
import { ODTExporter } from '@blocknote/xl-odt-exporter';
import { PDFExporter } from '@blocknote/xl-pdf-exporter';
import { DocumentProps, pdf } from '@react-pdf/renderer';
import jsonemoji from 'emoji-datasource-apple' with { type: 'json' };
import i18next from 'i18next';
import { cloneElement, isValidElement } from 'react';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { Doc } from '@/docs/doc-management/types';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { docxDocsSchemaMappings } from '../mappingDocx';
import { odtDocsSchemaMappings } from '../mappingODT';
import { pdfDocsSchemaMappings } from '../mappingPDF';

export const useExportAGPL = (doc: Doc, editor?: DocsBlockNoteEditor) => {
  const { t } = useTranslation();

  const docToBlob = async (format: string, documentTitle: string) => {
    if (!editor) {
      return;
    }

    const exportDocument = editor.document;
    let blobExport: Blob | undefined = undefined;
    if (format === 'pdf') {
      const exporter = new PDFExporter(editor.schema, pdfDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        emojiSource: {
          format: 'png',
          builder(code) {
            const emojisFound = jsonemoji.filter(
              (e) =>
                e.unified.split('-')[0].toLowerCase() ===
                code.split('-')[0].toLowerCase(),
            );

            const emoji = emojisFound.find((e) =>
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
    } else if (format === 'docx') {
      const exporter = new DOCXExporter(editor.schema, docxDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
      });

      blobExport = await exporter.toBlob(exportDocument, {
        documentOptions: { title: documentTitle },
        sectionOptions: {},
      });
    } else if (format === 'odt') {
      const exporter = new ODTExporter(editor.schema, odtDocsSchemaMappings, {
        resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
      });

      blobExport = await exporter.toODTDocument(exportDocument);
    }

    return blobExport;
  };

  return {
    formats: [
      { label: t('PDF'), value: 'pdf' },
      { label: t('Docx'), value: 'docx' },
      { label: t('ODT'), value: 'odt' },
    ],
    docToBlob,
  };
};
