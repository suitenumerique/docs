import dynamic from 'next/dynamic';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { css } from 'styled-components';

import { Box, Loading } from '@/components';
import { useEditorStore } from '@/docs/doc-editor/stores';
import { useDocStore } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { usePresenterStore } from '../stores';

const coverCss = css`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: white;
`;

/**
 * Full-screen white cover shown while the editor boots, so opening the
 * presenter never reveals the layout → skeleton → editor cascade underneath.
 * Same background and z-index as the presenter overlay, so the swap to slides
 * is seamless.
 */
const PresenterBootCover = () => {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <Box $css={coverCss}>
      <Loading />
    </Box>,
    document.body,
  );
};

const PresenterOverlay = dynamic(
  () =>
    import('./PresenterOverlay').then((mod) => ({
      default: mod.PresenterOverlay,
    })),
  { ssr: false, loading: () => <PresenterBootCover /> },
);

/**
 * Single mount point for the presenter, rendered high in the tree (doc page).
 * Drives the manual "Present" action via `usePresenterStore`, painting a boot
 * cover until the editor snapshot is available.
 */
export const PresenterRoot = () => {
  const { isMobile } = useResponsiveStore();
  const editor = useEditorStore((state) => state.editor);
  const { currentDoc } = useDocStore();
  const { isOpen, close } = usePresenterStore();

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const active = !isMobile && isOpen;
  const isBooting = active && (!editor || !currentDoc);

  // Let users escape the boot cover if the editor never finishes loading.
  useEffect(() => {
    if (!isBooting) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBooting, handleClose]);

  if (!active) {
    return null;
  }

  if (!editor || !currentDoc) {
    return <PresenterBootCover />;
  }

  return <PresenterOverlay doc={currentDoc} onClose={handleClose} />;
};
