import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
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
 * Full-screen white cover shown while the editor boots, so a `?view=present`
 * deep-link never reveals the layout → skeleton → editor cascade underneath.
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
 * Drives both the manual "Present" action (via `usePresenterStore`) and the
 * `?view=present[&slide=N]` deep-link (via the URL), painting a boot cover
 * until the editor snapshot is available.
 */
export const PresenterRoot = () => {
  const router = useRouter();
  const { isMobile } = useResponsiveStore();
  const editor = useEditorStore((state) => state.editor);
  const { currentDoc } = useDocStore();
  const { isOpen, initialIndex, close } = usePresenterStore();

  const wantsPresent = router.query.view === 'present';
  const slideParam = Number(router.query.slide);
  const urlInitialIndex =
    Number.isFinite(slideParam) && slideParam >= 1 ? slideParam - 1 : 0;

  const syncSlideToUrl = useCallback(
    (index: number) => {
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, view: 'present', slide: index + 1 },
        },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const handleClose = useCallback(() => {
    close();
    const { view: _view, slide: _slide, ...rest } = router.query;
    void router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
    });
  }, [close, router]);

  // The presenter is active from a manual open OR a deep-link; deriving it from
  // `wantsPresent` lets the cover paint on the very first render, before the
  // layout cascade shows.
  const active = !isMobile && (isOpen || wantsPresent);
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

  // A manual open carries its own start slide; a deep-link reads it from the URL.
  const startIndex = isOpen ? initialIndex : urlInitialIndex;

  return (
    <PresenterOverlay
      doc={currentDoc}
      initialIndex={startIndex}
      onIndexChange={syncSlideToUrl}
      onClose={handleClose}
    />
  );
};
