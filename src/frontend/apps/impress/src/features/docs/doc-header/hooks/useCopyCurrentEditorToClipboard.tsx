import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../doc-editor';

export const useCopyCurrentEditorToClipboard = () => {
  const { editor } = useEditorStore();
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return async (asFormat: 'html' | 'markdown') => {
    if (!editor) {
      const message = t('Editor unavailable');
      toast(message, VariantType.ERROR, { duration: 3000 });
      return;
    }

    try {
      const editorContentFormatted =
        asFormat === 'html'
          ? await editor.blocksToHTMLLossy()
          : await editor.blocksToMarkdownLossy();
      await navigator.clipboard.writeText(editorContentFormatted);
      const successMessage =
        asFormat === 'markdown'
          ? t('Copied as Markdown to clipboard')
          : t('Copied to clipboard');

      toast(successMessage, VariantType.SUCCESS, { duration: 3000 });
    } catch (error) {
      console.error(error);
      const errorMessage =
        asFormat === 'markdown'
          ? t('Failed to copy as Markdown to clipboard')
          : t('Failed to copy to clipboard');

      toast(errorMessage, VariantType.ERROR, {
        duration: 3000,
      });
    }
  };
};
