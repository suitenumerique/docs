import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo } from 'react';
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
 * Drives both the manual "Present" action (via `usePresenterStore`) and the
 * `?view=present[&slide=N]` deep-link (via the URL), painting a boot cover
 * until the editor snapshot is available.
 */
export const PresenterRoot = () => {
  const router = useRouter();
  const { isMobile } = useResponsiveStore();
  const editor = useEditorStore((state) => state.editor);
  const { currentDoc } = useDocStore();
  const { initialSlideIndex, isOpen, close } = usePresenterStore();

  const urlSearchParams = useMemo(() => {
    const queryString = router.asPath.split('?')[1]?.split('#')[0] ?? '';
    return new URLSearchParams(queryString);
  }, [router.asPath]);
  const viewParam = router.query.view ?? urlSearchParams.get('view');
  const slideQueryParam = router.query.slide ?? urlSearchParams.get('slide');
  const slideParam = Number(
    Array.isArray(slideQueryParam) ? slideQueryParam[0] : slideQueryParam,
  );
  const wantsPresent =
    (Array.isArray(viewParam) ? viewParam[0] : viewParam) === 'present';
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

  useEffect(() => {
    if (isMobile && isOpen) {
      handleClose();
    }
  }, [isMobile, isOpen, handleClose]);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

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
    return <Loading $css={coverCss} />;
  }

  // A manual open carries its own start slide; a deep-link reads it from the URL.
  const startIndex = isOpen ? initialSlideIndex : urlInitialIndex;

  return (
    <PresenterOverlay
      doc={currentDoc}
      initialSlideIndex={startIndex}
      onIndexChange={syncSlideToUrl}
      onClose={handleClose}
    />
  );
};
