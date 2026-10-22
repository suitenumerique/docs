/**
 * These export modules are GPL licensed and should only
 * be used when the application is not published as MIT.
 */
import { DOCXExporter } from '@blocknote/xl-docx-exporter';
import { ODTExporter } from '@blocknote/xl-odt-exporter';
import { useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { Doc } from '@/docs/doc-management/types';
import { fallbackLng } from '@/i18n/config';

import { exportCorsResolveFileUrl } from '../api/exportResolveFileUrl';
import { DocsPDFExporter } from '../exporterPDF';
import { getDocxDocsSchemaMappings } from '../mappingDocx';
import { getOdtDocsSchemaMappings } from '../mappingODT';
import { getPdfDocsSchemaMappings } from '../mappingPDF';
import { resolveInterlinkTitles } from '../utils';
import { expandDocChildrenBlocks } from '../utils_doc_children';

/**
 * The formats built by this hook, the others are built by the export modal
 */
const XL_EXPORT_FORMATS = ['pdf', 'docx', 'odt'];

export const useExportXL = (doc: Doc, editor?: DocsBlockNoteEditor) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const docToBlob = async (format: string, documentTitle: string) => {
    // The export modal asks every format first: return before fetching the
    // sub-docs and the titles of the interlinks for a format built elsewhere.
    if (!editor || !XL_EXPORT_FORMATS.includes(format)) {
      return;
    }

    const exportDocument = await expandDocChildrenBlocks(
      editor.document,
      doc.id,
      queryClient,
    );
    const interlinkTitles = await resolveInterlinkTitles(
      exportDocument,
      queryClient,
    );
    const imageUnavailableText = t('This image could not be exported.', {
      description:
        'Shown in an exported document in place of an image that could not be fetched',
    });
    let blobExport: Blob | undefined = undefined;
    if (format === 'pdf') {
      const exporter = new DocsPDFExporter(
        editor.schema,
        getPdfDocsSchemaMappings(interlinkTitles, imageUnavailableText),
        {
          resolveFileUrl: async (url) => exportCorsResolveFileUrl(doc.id, url),
        },
      );

      // The title and the language are required to declare the PDF as
      // accessible (PDF/UA-1). A document that does not conform, e.g. that
      // does not start with a level 1 heading, is still exported as a tagged
      // PDF, only without the conformance claim.
      // Typst only accepts the language code, a region ("en-US") fails the
      // compilation.
      const result = await exporter.toPDF(exportDocument, {
        title: documentTitle,
        lang: (i18next.language || fallbackLng).split(/[-_]/)[0],
      });

      if (result.error) {
        throw new Error(
          `PDF compilation failed: ${result.compileErrors
            .map((error) => error.message)
            .join(', ')}`,
        );
      }

      blobExport = result.blob;
    } else if (format === 'docx') {
      const exporter = new DOCXExporter(
        editor.schema,
        getDocxDocsSchemaMappings(interlinkTitles, imageUnavailableText),
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
        getOdtDocsSchemaMappings(interlinkTitles, imageUnavailableText),
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
