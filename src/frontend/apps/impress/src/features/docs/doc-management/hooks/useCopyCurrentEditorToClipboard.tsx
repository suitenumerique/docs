import { VariantType } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import { expandDocChildrenBlocks } from '@/docs/doc-export/utils_doc_children';
import { useToast } from '@/hooks';

import { useDocStore } from '../stores';

export const useCopyCurrentEditorToClipboard = () => {
  const { editor } = useEditorStore();
  const { currentDoc } = useDocStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  return async (asFormat: 'html' | 'markdown') => {
    if (!editor) {
      const message = t('Editor unavailable');
      toast(message, VariantType.ERROR, { duration: 3000 });
      return;
    }

    try {
      const blocks = currentDoc
        ? await expandDocChildrenBlocks(editor.document, currentDoc.id)
        : editor.document;
      const editorContentFormatted =
        asFormat === 'html'
          ? editor.blocksToHTMLLossy(blocks)
          : editor.blocksToMarkdownLossy(blocks);
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
