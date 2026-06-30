import dynamic from 'next/dynamic';
import { useCallback, useEffect } from 'react';
import { css } from 'styled-components';

import { Loading } from '@/components';
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

const PresenterOverlay = dynamic(
  () =>
    import('./PresenterOverlay').then((mod) => ({
      default: mod.PresenterOverlay,
    })),
  { ssr: false, loading: () => <Loading $css={coverCss} /> },
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
  const { initialSlideIndex, isOpen, close } = usePresenterStore();

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  useEffect(() => {
    if (isMobile && isOpen) {
      close();
    }
  }, [isMobile, isOpen, close]);

  useEffect(() => {
    return () => {
      close();
    };
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
    return <Loading $css={coverCss} />;
  }

  return (
    <PresenterOverlay
      doc={currentDoc}
      initialSlideIndex={initialSlideIndex}
      onClose={handleClose}
    />
  );
};
