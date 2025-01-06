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
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { pdf } from '@react-pdf/renderer';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useEditorStore } from '@/features/docs/doc-editor';
import { Doc } from '@/features/docs/doc-management';

import { TemplatesOrdering, useTemplates } from '../api/useTemplates';
import { downloadFile } from '../utils';

export enum DocDownloadFormat {
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
  const [format, setFormat] = useState<DocDownloadFormat>(
    DocDownloadFormat.PDF,
  );

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
    if (!format) {
      return;
    }

    if (!editor) {
      toast(t('No editor found'), VariantType.ERROR);
      return;
    }

    const title = doc.title
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

    let blobExport;
    if (format === 'pdf') {
      const exporter = new PDFExporter(editor.schema, pdfDefaultSchemaMappings);
      const pdfDocument = await exporter.toReactPDFDocument(exportDocument);
      blobExport = await pdf(pdfDocument).toBlob();
    } else {
      const exporter = new DOCXExporter(
        editor.schema,
        docxDefaultSchemaMappings,
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
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Download')}
            color="primary"
            fullWidth
            onClick={() => void onSubmit()}
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
          {t(
            'Upload your docs to a Microsoft Word, Open Office or PDF document.',
          )}
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
            { label: t('Word / Open Office'), value: DocDownloadFormat.DOCX },
            { label: t('PDF'), value: DocDownloadFormat.PDF },
          ]}
          value={format}
          onChange={(options) =>
            setFormat(options.target.value as DocDownloadFormat)
          }
        />
      </Box>
    </Modal>
  );
};
