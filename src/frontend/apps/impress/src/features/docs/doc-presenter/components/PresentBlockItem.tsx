import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import type { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import PresentIcon from '@/icons/present.svg';
import { useResponsiveStore } from '@/stores';

import { getContentSlideIndexForBlock } from '../hooks/useSlides';
import { usePresenterStore } from '../stores';
import type { PresenterBlock } from '../types';

export const PresentBlockItem = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });
  const openPresenter = usePresenterStore((state) => state.open);
  const { isMobile } = useResponsiveStore();

  // Hidden on mobile (no presenter there) and until a block is targeted
  // (no drag handle hovered yet).
  if (Components === undefined || block === undefined || isMobile) {
    return null;
  }

  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const contentSlideIndex = getContentSlideIndexForBlock(
          editor.document as PresenterBlock[],
          block.id,
        );

        // Overlay slide 0 is the generated title slide; content slides start
        // at index 1, hence the +1 on the 0-based content-slide index.
        openPresenter(contentSlideIndex + 1);
      }}
    >
      <Box $align="center" $gap="xxs" $direction="row">
        <PresentIcon width="16" height="16" aria-hidden="true" />
        {t('Present from here')}
      </Box>
    </Components.Generic.Menu.Item>
  );
};
