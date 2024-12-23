import {
  Button,
  Loader,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useEditorStore } from '@/features/docs/doc-editor';
import { Doc } from '@/features/docs/doc-management';

import { useExport } from '../api/useExport';
import { TemplatesOrdering, useTemplates } from '../api/useTemplates';
import { adaptBlockNoteHTML, downloadFile } from '../utils';

export enum DocDownloadFormat {
  PDF = 'pdf',
  DOCX = 'docx',
}

interface ModalPDFProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalPDF = ({ onClose, doc }: ModalPDFProps) => {
  const { t } = useTranslation();
  const { data: templates } = useTemplates({
    ordering: TemplatesOrdering.BY_CREATED_ON_DESC,
  });
  const { toast } = useToastProvider();
  const { editor } = useEditorStore();
  const {
    mutate: createExport,
    data: documentGenerated,
    isSuccess,
    isPending,
    error,
  } = useExport();
  const [templateIdSelected, setTemplateIdSelected] = useState<string>();
  const [format, setFormat] = useState<DocDownloadFormat>(
    DocDownloadFormat.PDF,
  );

  const templateOptions = useMemo(() => {
    if (!templates?.pages) {
      return [];
    }

    const templateOptions = templates.pages
      .map((page) =>
        page.results.map((template) => ({
          label: template.title,
          value: template.id,
        })),
      )
      .flat();

    if (templateOptions.length) {
      setTemplateIdSelected(templateOptions[0].value);
    }

    return templateOptions;
  }, [templates?.pages]);

  useEffect(() => {
    if (!error) {
      return;
    }

    toast(error.message, VariantType.ERROR);

    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, t]);

  useEffect(() => {
    if (!documentGenerated || !isSuccess) {
      return;
    }

    // normalize title
    const title = doc.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s/g, '-');

    downloadFile(documentGenerated, `${title}.${format}`);

    toast(
      t('Your {{format}} was downloaded succesfully', {
        format,
      }),
      VariantType.SUCCESS,
    );

    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentGenerated, isSuccess, t]);

  async function onSubmit() {
    if (!templateIdSelected || !format) {
      return;
    }

    if (!editor) {
      toast(t('No editor found'), VariantType.ERROR);
      return;
    }

    let body = await editor.blocksToFullHTML(editor.document);
    body = adaptBlockNoteHTML(body);

    createExport({
      templateId: templateIdSelected,
      body,
      body_type: 'html',
      format,
    });
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
            disabled={isPending || !templateIdSelected}
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
          value={templateIdSelected}
          onChange={(options) =>
            setTemplateIdSelected(options.target.value as string)
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

        {isPending && (
          <Box $align="center" $margin={{ top: 'big' }}>
            <Loader />
          </Box>
        )}
      </Box>
    </Modal>
  );
};
