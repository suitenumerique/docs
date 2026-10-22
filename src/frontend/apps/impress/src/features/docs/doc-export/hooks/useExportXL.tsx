/**
 * These export modules are GPL licensed and should only
 * be used when the application is not published as MIT.
 */
import { DOCXExporter } from '@blocknote/xl-docx-exporter';
import { ODTExporter } from '@blocknote/xl-odt-exporter';
import { PDFExporter } from '@blocknote/xl-pdf-exporter';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { Doc } from '@/docs/doc-management/types';
import { fallbackLng } from '@/i18n/config';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { getDocxDocsSchemaMappings } from '../mappingDocx';
import { getOdtDocsSchemaMappings } from '../mappingODT';
import { getPdfDocsSchemaMappings } from '../mappingPDF';
import { resolveInterlinkTitles } from '../utils';

export const useExportXL = (doc: Doc, editor?: DocsBlockNoteEditor) => {
  const { t } = useTranslation();

  const docToBlob = async (format: string, documentTitle: string) => {
    if (!editor) {
      return;
    }

    const exportDocument = editor.document;
    const interlinkTitles = await resolveInterlinkTitles(exportDocument);
    let blobExport: Blob | undefined = undefined;
    if (format === 'pdf') {
      const exporter = new PDFExporter(
        editor.schema,
        getPdfDocsSchemaMappings(interlinkTitles),
        {
          resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        },
      );
      const result = await exporter.toPDF(exportDocument, {
        title: documentTitle,
        lang: (i18next.language || fallbackLng).split(/[-_]/)[0],
      });
      if (result.error) {
        console.error('PDF export failed', result.compileErrors);
        return;
      }
      blobExport = result.blob;
    } else if (format === 'docx') {
      const exporter = new DOCXExporter(
        editor.schema,
        getDocxDocsSchemaMappings(interlinkTitles),
        {
          resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        },
      );

      blobExport = await exporter.toBlob(exportDocument, {
        documentOptions: { title: documentTitle },
        sectionOptions: {},
      });
    } else if (format === 'odt') {
      const exporter = new ODTExporter(
        editor.schema,
        getOdtDocsSchemaMappings(interlinkTitles),
        {
          resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        },
      );

      blobExport = await exporter.toODTDocument(exportDocument);
    }

    return blobExport;
  };

  return {
    formats: [
      {
        label: t('PDF', {
          description: 'Name of the PDF file format / editor block',
        }),
        value: 'pdf',
        labelDescription: t('.pdf', {
          description: 'File extension hint of the PDF export',
        }),
      },
      {
        label: t('Docx', {
          description: 'Name of the Microsoft Word export format',
        }),
        value: 'docx',
        labelDescription: t('.docx', {
          description: 'File extension hint of the Word export',
        }),
      },
      {
        label: t('ODT', {
          description: 'Name of the OpenDocument text export format',
        }),
        value: 'odt',
        labelDescription: t('.odt', {
          description: 'File extension hint of the OpenDocument export',
        }),
      },
    ],
    docToBlob,
  };
};
