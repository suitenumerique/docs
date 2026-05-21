import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { CommentSideBar } from '@/features/docs/doc-editor/components/comments/CommentSideBar';
import { useDocStore, useProviderStore } from '@/features/docs/doc-management';
import { TableContentSideBar } from '@/features/docs/doc-table-content/components/TableContentSideBar';
import { HEADER_HEIGHT } from '@/features/header';
import { useResponsiveStore } from '@/stores';

import {
  RightPanelView,
  useRightPanelStore,
} from '../stores/useRightPanelStore';

export const RightPanel = () => {
  const { t } = useTranslation();
  const { currentDoc: doc } = useDocStore();
  const { setIsPanelOpen, isPanelOpen, activePanel } = useRightPanelStore();
  const { isMobile } = useResponsiveStore();
  const { provider, isReady } = useProviderStore();
  const isProviderReady =
    isReady && provider && provider?.configuration.name === doc?.id;

  /**
   * Keep rendering the last active panel during the close animation,
   * so the content doesn't vanish before the panel finishes sliding out.
   * When switching panels, the content swaps instantly.
   */
  const [renderedPanel, setRenderedPanel] = useState<RightPanelView | null>(
    null,
  );
  useEffect(() => {
    if (activePanel !== null) {
      setRenderedPanel(activePanel);
    } else {
      const timer = setTimeout(() => setRenderedPanel(null), 500);
      return () => clearTimeout(timer);
    }
  }, [activePanel]);

  if (!doc || !isProviderReady) {
    return null;
  }

  const ariaLabel = isPanelOpen
    ? t('Right panel, currently open')
    : t('Right panel, currently closed');

  const handleClose = () => setIsPanelOpen(false);

  return (
    <Box
      className="--docs--right-panel"
      aria-label={ariaLabel}
      aria-expanded={isPanelOpen}
      $width="300px"
      $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
      $position={isMobile ? 'absolute' : 'sticky'}
      $zIndex={25}
      $hasTransition
      $background="var(--c--contextuals--background--surface--secondary)"
      $css={css`
        flex-shrink: 0;
        border-left: 1px solid var(--c--contextuals--border--surface--primary);
        transform: translateX(0%);
        top: 0;
        right: 0;
        align-self: flex-start;
        opacity: 1;
        ${!isPanelOpen &&
        css`
          transform: translateX(200%);
          opacity: 0;
          margin-left: 0rem;
          width: 0;
        `}
      `}
    >
      {renderedPanel === 'tableContent' && (
        <TableContentSideBar onClose={handleClose} />
      )}
      {renderedPanel === 'comments' && <CommentSideBar onClose={handleClose} />}
    </Box>
  );
};
