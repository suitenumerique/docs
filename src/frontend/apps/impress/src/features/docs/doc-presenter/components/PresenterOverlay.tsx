import { announce, clearAnnouncer } from '@react-aria/live-announcer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FocusScope } from 'react-aria';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useEditorStore } from '@/docs/doc-editor/stores';
import { Doc, getEmojiAndTitle } from '@/docs/doc-management';

import { PRESENTER_WINDOW_RADIUS } from '../constants';
import { useBrowserFullscreen } from '../hooks/useBrowserFullscreen';
import { usePresenterShortcuts } from '../hooks/usePresenterShortcuts';
import { getSlideTitle, useSlides } from '../hooks/useSlides';
import type { PresenterBlock, PresenterSlideData } from '../types';

import { PresenterFloatingBar } from './PresenterFloatingBar';
import { PresenterSlide } from './PresenterSlide';

interface PresenterOverlayProps {
  doc: Doc;
  initialSlideIndex: number;
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

const clampSlideIndex = (index: number, total: number) =>
  Math.max(0, Math.min(index, Math.max(total - 1, 0)));

export const PresenterOverlay = ({
  doc,
  initialSlideIndex,
  onClose,
}: PresenterOverlayProps) => {
  const { t } = useTranslation();
  const editor = useEditorStore((state) => state.editor);

  // Snapshot the editor's blocks once at mount. Subsequent collaborator
  // edits do not affect the ongoing presentation (by design).
  const snapshotRef = useRef<PresenterBlock[] | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = editor ? [...editor.document] : [];
  }
  const snapshotBlocks = snapshotRef.current;

  const contentSlides = useSlides(snapshotBlocks);
  const title = useMemo(() => {
    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title ?? '');
    return [emoji, titleWithoutEmoji.trim() || t('Untitled document')]
      .filter(Boolean)
      .join(' ');
  }, [doc.title, t]);
  const slides = useMemo<PresenterSlideData[]>(
    () => [
      { kind: 'title', title, showDividerHint: false },
      ...contentSlides.map((blocks) => ({ kind: 'content' as const, blocks })),
    ],
    [contentSlides, title],
  );
  const total = slides.length;
  const [currentIndex, setCurrentIndex] = useState(() =>
    clampSlideIndex(initialSlideIndex, total),
  );
  const clamp = useCallback((i: number) => clampSlideIndex(i, total), [total]);

  useEffect(() => {
    setCurrentIndex(clamp(initialSlideIndex));
  }, [initialSlideIndex, clamp]);

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
    return Array.from({ length: to - from + 1 }, (_, k) => from + k);
  }, [currentIndex, total]);

  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentSlide = slides[currentIndex];
    const slideTitle =
      currentSlide?.kind === 'title'
        ? currentSlide.title
        : getSlideTitle(currentSlide?.blocks ?? []);
    const message = slideTitle
      ? t('Slide {{current}} of {{total}}: {{title}}', {
          current: currentIndex + 1,
          total,
          title: slideTitle,
        })
      : t('Slide {{current}} of {{total}}', {
          current: currentIndex + 1,
          total,
        });
    announce(message, 'polite');
    return () => clearAnnouncer('polite');
  }, [slides, currentIndex, total, t]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <FocusScope contain autoFocus restoreFocus>
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
              frameRef={frameRef}
              isCurrent={i === currentIndex}
              slide={slides[i]}
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
      </Box>
    </FocusScope>,
    document.body,
  );
};
