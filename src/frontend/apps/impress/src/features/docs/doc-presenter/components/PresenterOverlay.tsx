import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useEditorStore } from '@/docs/doc-editor/stores';
import { Doc } from '@/docs/doc-management';
import { useFocusStore } from '@/stores';

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
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const slideFrameBaseCss = css`
  height: 100%;
  background: white;
  overflow-y: auto;
  overflow-x: hidden;
  align-items: center;
  /* No \`justify-content: center\` here. The Box defaults to
   * \`display: flex; flex-direction: column\`, so justify-content would
   * center items along the main (vertical) axis. When a slide is taller
   * than the frame, centering an overflowing flex item clips the top —
   * the scroll cannot reach above position 0. Letting items start at the
   * top is safe in both cases: the slideWrapper has \`min-height: 100%\`,
   * so for short content it already fills the frame; long content scrolls
   * naturally from the top. */
`;

const slideFrameCss = css`
  ${slideFrameBaseCss};
  width: min(80%, 1800px);

  @media (max-width: 1000px) {
    width: 95%;
  }
`;

const slideFrameFullscreenCss = css`
  ${slideFrameBaseCss};
  width: 100%;
  max-width: none;
`;

const slideWrapperCss = css`
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  /* No \`align-items\` / \`justify-content\` here: the centerer inside uses
   * \`margin: auto\`, which distributes leftover space safely. When the
   * centerer fits, the auto margins center it; when it overflows, the
   * margins collapse to 0 instead of producing a negative offset, so the
   * top of the content stays reachable from scrollTop=0. */
`;

export const PresenterOverlay = ({
  doc: _doc,
  onClose,
}: PresenterOverlayProps) => {
  const { t } = useTranslation();
  const editor = useEditorStore((state) => state.editor);
  const { addLastFocus } = useFocusStore();

  // Snapshot the editor's blocks once at mount. Subsequent collaborator
  // edits do not affect the ongoing presentation (by design).
  const snapshotRef = useRef<unknown[] | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = editor ? [...editor.document] : [];
  }
  const snapshotBlocks = snapshotRef.current;

  // The presenter is opened from a dropdown menu item which doesn't expose
  // its trigger to the click handler — so we capture the previously focused
  // element here, on mount, after the dropdown has restored focus to its
  // trigger button. `restoreFocus()` is then called by the parent on close.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    addLastFocus(document.activeElement as HTMLElement | null);
  }, [addLastFocus]);

  const slides = useSlides(snapshotBlocks as { type: string }[]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

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
    // Defer fullscreen until the overlay layout has committed so the slide
    // frame has non-zero dimensions for the first useFitScale pass.
    const rafId = requestAnimationFrame(() => {
      // void enter();
    });
    return () => {
      cancelAnimationFrame(rafId);
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
      <Box $css={slideAreaCss}>
        <Box
          $css={isFullscreen ? slideFrameFullscreenCss : slideFrameCss}
          ref={frameRef}
        >
          <Box key={currentIndex} $css={slideWrapperCss}>
            <PresenterSlide
              blocks={slides[currentIndex]}
              frameRef={frameRef}
              isFullscreen={isFullscreen}
              ariaLabel={t('Slide {{current}} of {{total}}', {
                current: currentIndex + 1,
                total,
              })}
            />
          </Box>
        </Box>
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
