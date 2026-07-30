import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useClipboard } from '@/hooks';
import LinkIcon from '@/icons/link.svg';

import type { DocsBlockNoteEditor } from '../../types';

export const LinkToBlockItem = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const copyToClipboard = useClipboard();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  const copyLinkToBlock = useCallback(() => {
    if (!block) {
      return;
    }

    copyToClipboard(
      `${window.location.origin}${window.location.pathname}#${block.id}`,
      t('Link Copied !'),
      t('Failed to copy link'),
    );
  }, [block, copyToClipboard, t]);

  if (Components === undefined || block === undefined) {
    return null;
  }

  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={copyLinkToBlock}
    >
      <Box $align="center" $gap="xxs" $direction="row">
        <LinkIcon width="16" height="16" aria-hidden="true" />
        {t('Copy link to block')}
      </Box>
    </Components.Generic.Menu.Item>
  );
};
