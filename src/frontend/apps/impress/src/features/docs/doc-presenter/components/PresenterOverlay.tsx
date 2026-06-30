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
import { useCopyPresenterLink } from '../hooks/useCopyPresenterLink';
import { usePresenterShortcuts } from '../hooks/usePresenterShortcuts';
import { getSlideTitle, useSlides } from '../hooks/useSlides';
import { PresenterBlock, PresenterSlideData } from '../types';

import { PresenterDocsLogo } from './PresenterDocsLogo';
import { PresenterFloatingBar } from './PresenterFloatingBar';
import { PresenterSlide } from './PresenterSlide';

interface PresenterOverlayProps {
  doc: Doc;
  onClose: () => void;
  /** 0-based slide to start on (e.g. from a `?slide=` deep-link). */
  initialIndex?: number;
  /** Notified whenever the current slide changes (used to sync the URL). */
  onIndexChange?: (index: number) => void;
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

const docsLogoCss = css`
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 1;
`;

export const PresenterOverlay = ({
  doc,
  onClose,
  initialIndex = 0,
  onIndexChange,
}: PresenterOverlayProps) => {
  const { t } = useTranslation();
  const editor = useEditorStore((state) => state.editor);
  const copyPresenterLink = useCopyPresenterLink(doc.id);

  // Snapshot the editor's blocks once at mount. Subsequent collaborator
  // edits do not affect the ongoing presentation (by design).
  const snapshotRef = useRef<unknown[] | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = editor ? [...editor.document] : [];
  }
  const snapshotBlocks = snapshotRef.current;

  const contentSlides = useSlides(snapshotBlocks as PresenterBlock[]);
  const title = useMemo(() => {
    const { titleWithoutEmoji } = getEmojiAndTitle(doc.title ?? '');
    return titleWithoutEmoji.trim() || t('Untitled document');
  }, [doc.title, t]);
  const slides = useMemo<PresenterSlideData[]>(
    () => [
      { kind: 'title', title, showDividerHint: false },
      ...contentSlides.map((blocks) => ({ kind: 'content' as const, blocks })),
    ],
    [contentSlides, title],
  );
  // Clamp to a valid slide already at init (not only via the effect below), so
  // an out-of-range deep-link (e.g. `slide=99`) never emits a transient
  // out-of-range `slide=` to the URL before being snapped back.
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), slides.length - 1),
  );

  const total = slides.length;
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(i, total - 1)),
    [total],
  );

  // `total` is only known after slides are computed, so a deep-link with an
  // out-of-range slide (e.g. `slide=99`) is snapped to the last slide here.
  useEffect(() => {
    setCurrentIndex((i) => clamp(i));
  }, [clamp]);

  // Keep the URL (or any consumer) in sync with the displayed slide. Also fires
  // on mount, so opening manually writes `slide=1` to the address bar. The ref
  // guard ensures we only notify on a real slide change: `onIndexChange` may
  // change identity when the consumer rewrites the URL, and re-emitting the
  // same index would loop.
  const lastEmittedRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastEmittedRef.current !== currentIndex) {
      lastEmittedRef.current = currentIndex;
      onIndexChange?.(currentIndex);
    }
  }, [currentIndex, onIndexChange]);

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
        : getSlideTitle((currentSlide?.blocks ?? []) as PresenterBlock[]);
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
    // The ui-kit DropdownMenu renders its popover in a React Aria portal.
    // Keeping the FocusScope contained here prevents that portalled menu from
    // receiving focus, which makes the dropdown close as soon as it opens.
    <FocusScope autoFocus restoreFocus>
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

        <Box $css={docsLogoCss}>
          <PresenterDocsLogo />
        </Box>

        <PresenterFloatingBar
          index={currentIndex}
          total={total}
          isFullscreen={isFullscreen}
          onPrev={goPrev}
          onNext={goNext}
          onCopyLink={() => copyPresenterLink(currentIndex)}
          onToggleFullscreen={() => void toggle()}
          onClose={onClose}
        />
      </Box>
    </FocusScope>,
    document.body,
  );
};
