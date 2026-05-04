import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useEditorStore } from '@/docs/doc-editor/stores';
import { Doc } from '@/docs/doc-management';

import { PRESENTER_WINDOW_RADIUS } from '../constants';
import { useBrowserFullscreen } from '../hooks/useBrowserFullscreen';
import { usePresenterShortcuts } from '../hooks/usePresenterShortcuts';
import { useSlides } from '../hooks/useSlides';

import { PresenterFloatingBar } from './PresenterFloatingBar';
import { PresenterSlide } from './PresenterSlide';

interface PresenterOverlayProps {
  doc: Doc;
  onClose: () => void;
}

const overlayCss = css`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: white;
  display: flex;
  flex-direction: column;
`;

const slideAreaCss = css`
  flex: 1;
  position: relative;
  overflow: hidden;
  background: white;
`;

export const PresenterOverlay = ({
  doc: _doc,
  onClose,
}: PresenterOverlayProps) => {
  const { t } = useTranslation();
  const editor = useEditorStore((state) => state.editor);

  // Snapshot the editor's blocks once at mount. Subsequent collaborator
  // edits do not affect the ongoing presentation (by design).
  const snapshotRef = useRef<unknown[] | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = editor ? [...editor.document] : [];
  }
  const snapshotBlocks = snapshotRef.current;

  const slides = useSlides(snapshotBlocks as { type: string }[]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = slides.length;
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(i, total - 1)),
    [total],
  );

  const goPrev = useCallback(
    () => setCurrentIndex((i) => clamp(i - 1)),
    [clamp],
  );
  const goNext = useCallback(
    () => setCurrentIndex((i) => clamp(i + 1)),
    [clamp],
  );
  const goFirst = useCallback(() => setCurrentIndex(0), []);
  const goLast = useCallback(
    () => setCurrentIndex(clamp(total - 1)),
    [clamp, total],
  );

  const { isFullscreen, enter, exitIfOwned, toggle } = useBrowserFullscreen();

  useEffect(() => {
    void enter();
    return () => {
      void exitIfOwned();
    };
  }, [enter, exitIfOwned]);

  usePresenterShortcuts({
    onPrev: goPrev,
    onNext: goNext,
    onFirst: goFirst,
    onLast: goLast,
    onToggleFullscreen: () => void toggle(),
    onClose,
    isFullscreen,
  });

  const mountedIndices = useMemo(() => {
    const from = Math.max(0, currentIndex - PRESENTER_WINDOW_RADIUS);
    const to = Math.min(total - 1, currentIndex + PRESENTER_WINDOW_RADIUS);
    const indices: number[] = [];
    for (let i = from; i <= to; i += 1) {
      indices.push(i);
    }
    return indices;
  }, [currentIndex, total]);

  const frameRef = useRef<HTMLDivElement>(null);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <Box
      $css={overlayCss}
      role="dialog"
      aria-modal="true"
      aria-label={t('Presenter mode')}
    >
      <Box ref={frameRef} $css={slideAreaCss}>
        {mountedIndices.map((i) => (
          <PresenterSlide
            key={i}
            blocks={slides[i] as unknown[]}
            frameRef={frameRef}
            isCurrent={i === currentIndex}
            ariaLabel={t('Slide {{current}} of {{total}}', {
              current: i + 1,
              total,
            })}
          />
        ))}
      </Box>

      <PresenterFloatingBar
        index={currentIndex}
        total={total}
        isFullscreen={isFullscreen}
        onPrev={goPrev}
        onNext={goNext}
        onToggleFullscreen={() => void toggle()}
        onClose={onClose}
      />
    </Box>,
    document.body,
  );
};
