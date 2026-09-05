import {
  Button,
  Loader,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import i18next from 'i18next';
import JSZip from 'jszip';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, ButtonCloseModal, Text } from '@/components';
import { useMediaUrl } from '@/core';
import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import { type Doc, useTrans } from '@/docs/doc-management';
import { fallbackLng } from '@/i18n/config';

import ModulesExport from '../hooks/';
import { downloadFile } from '../utils';
import {
  addMediaFilesToZip,
  generateHtmlDocument,
  improveHtmlAccessibility,
} from '../utils_html';

const useExportAGPL = ModulesExport?.useExportAGPL;

interface ModalExportProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalExport = ({ onClose, doc }: ModalExportProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { editor } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const { untitledDocument } = useTrans();
  const mediaUrl = useMediaUrl();
  const selectRef = useRef<HTMLDivElement>(null);
  const exportAGPL = useExportAGPL?.(doc, editor);
  const [format, setFormat] = useState(
    exportAGPL?.formats.find((opt) => opt.value === 'pdf')?.value || 'html',
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const button = selectRef.current?.querySelector<HTMLButtonElement>(
        'button, [role="combobox"]',
      );
      button?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const formatSelect = useMemo(() => {
    const formatOptions = (exportAGPL?.formats || []).concat([
      {
        label: t('HTML'),
        value: 'html',
        labelDescription: t('.html(zip)'),
      },
    ]);

    const formatLabels = Object.fromEntries(
      formatOptions.map((opt) => [opt.value, opt.label]),
    );

    const labels = formatOptions.map((opt) => opt.labelDescription);
    const or = t('or', {
      description:
        'Word joining the last two items of the list of available export formats',
    });
    const allFormatsLabel =
      labels.length > 1
        ? `${labels.slice(0, -1).join(', ')} ${or} ${labels[labels.length - 1]}`
        : labels.join('');

    return { formatOptions, formatLabels, allFormatsLabel };
  }, [t, exportAGPL?.formats]);

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

    let blobExport = await exportAGPL?.docToBlob(format, documentTitle);

    if (!blobExport && format === 'html') {
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
    }

    if (!blobExport) {
      toast(t('The export failed'), VariantType.ERROR);
      setIsExporting(false);
      return;
    }

    const downloadExtension = format === 'html' ? 'zip' : format;

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
      aria-labelledby="modal-export-title"
      aria-describedby="modal-export-description"
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
            aria-label={t('Download {{format}}', {
              format: formatSelect.formatLabels[format],
            })}
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
        <>
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
          <Box $position="absolute" $css="top: 4px; right: 4px;">
            <ButtonCloseModal
              aria-label={t('Close the download modal')}
              onClick={() => onClose()}
              disabled={isExporting}
            />
          </Box>
        </>
      }
    >
      <Box
        $margin={{ bottom: 'xl' }}
        $gap="1rem"
        className="--docs--modal-export-content"
      >
        <Text
          $variation="secondary"
          $size="sm"
          as="p"
          id="modal-export-description"
        >
          {t('Export your document to download in {{format}} format.', {
            format: formatSelect.allFormatsLabel,
          })}
        </Text>
        <Box ref={selectRef}>
          <Select
            clearable={false}
            fullWidth
            label={t('Format')}
            options={formatSelect.formatOptions}
            value={format}
            onChange={(options) => setFormat(options.target.value as string)}
          />
        </Box>

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
