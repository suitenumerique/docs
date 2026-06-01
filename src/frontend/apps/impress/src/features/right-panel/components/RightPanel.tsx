import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { CommentSideBar } from '@/features/docs/doc-comments/components/CommentSideBar';
import { useDocStore, useProviderStore } from '@/features/docs/doc-management';
import { TableContentSideBar } from '@/features/docs/doc-table-content/components/TableContentSideBar';
import { HEADER_HEIGHT } from '@/features/header';
import { useFocusStore, useResponsiveStore } from '@/stores';

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
  const { restoreFocus } = useFocusStore();

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

  /**
   * Focus the panel when it opens or when the rendered panel changes,
   * so that keyboard users are placed in the panel content immediately.
   */
  const panelRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (isPanelOpen) {
      panelRef.current?.focus();
    }
  }, [isPanelOpen, renderedPanel]);

  if (!doc || !isProviderReady) {
    return null;
  }

  const panelLabel =
    renderedPanel === 'comments'
      ? t('Comments side panel')
      : renderedPanel === 'tableContent'
        ? t('Table of contents side panel')
        : t('Side panel');

  const handleClose = () => {
    setIsPanelOpen(false);
    restoreFocus();
  };

  return (
    <Box
      as="aside"
      ref={panelRef}
      tabIndex={-1}
      className="--docs--right-panel"
      aria-label={panelLabel}
      inert={!isPanelOpen}
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

        &:focus {
          outline: none;
        }
      `}
    >
      {renderedPanel === 'tableContent' && (
        <TableContentSideBar onClose={handleClose} />
      )}
      {renderedPanel === 'comments' && <CommentSideBar onClose={handleClose} />}
    </Box>
  );
};
