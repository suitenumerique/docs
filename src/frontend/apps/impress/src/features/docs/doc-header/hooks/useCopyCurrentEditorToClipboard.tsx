import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../doc-editor';

export const useCopyCurrentEditorToClipboard = () => {
  const { editor } = useEditorStore();
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return async (asFormat: 'html' | 'markdown') => {
    if (!editor) {
      toast(t('Editor unavailable'), VariantType.ERROR, { duration: 3000 });
      return;
    }

    try {
      const editorContentFormatted =
        asFormat === 'html'
          ? await editor.blocksToHTMLLossy()
          : await editor.blocksToMarkdownLossy();
      await navigator.clipboard.writeText(editorContentFormatted);
      toast(t('Copied to clipboard'), VariantType.SUCCESS, { duration: 3000 });
    } catch (error) {
      console.error(error);
      toast(t('Failed to copy to clipboard'), VariantType.ERROR, {
        duration: 3000,
      });
    }
  };
};
