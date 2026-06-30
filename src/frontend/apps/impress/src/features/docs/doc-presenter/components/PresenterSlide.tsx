import { RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';

import {
  PRESENTER_FRAME_PADDING_Y,
  PRESENTER_SLIDE_DESIGN_WIDTH,
  PRESENTER_SLIDE_FADE_MS,
} from '../constants';
import { useFitScale } from '../hooks/useFitScale';
import { PresenterSlideData } from '../types';

import { PresenterSlideContent } from './PresenterSlideContent';
import { PresenterTitleSlide } from './PresenterTitleSlide';

interface PresenterSlideProps {
  frameRef: RefObject<HTMLDivElement | null>;
  isCurrent: boolean;
  slide: PresenterSlideData;
  ariaLabel?: string;
}

// Outer is the scroll container. It always spans the full frame height so the
// content can scroll all the way to the visual top/bottom of the viewport when
// the user drags the scrollbar. The top/bottom padding provides the breathing
// room at rest (scrollTop = 0 shows the content offset by paddingY); when the
// user scrolls, the padding scrolls off with the content (classic scroll-padding
// behaviour you get for free from padding on a scroll container).
//
// We use display: flex + margin: auto on the stage to centre vertically when
// the content fits, while still allowing the stage to overflow (and scroll)
// when it doesn't fit — a well-known CSS idiom (`align-items: center` would
// instead clip the overflowing top).
const outerCss = css`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 100%;
  box-sizing: border-box;
  padding-top: ${PRESENTER_FRAME_PADDING_Y}px;
  padding-bottom: ${PRESENTER_FRAME_PADDING_Y}px;
  overflow-y: auto;
  overflow-x: hidden;
  background: white;
  transition: opacity ${PRESENTER_SLIDE_FADE_MS}ms ease;
`;

// The stage absorbs the un-scaled inner's layout box. Its explicit height
// matches the painted height of the scaled inner (`naturalH × scale`), so
// the scroll container sees a `scrollHeight` aligned with what the user
// actually sees — not the un-transformed layout box.
// `margin: auto` centres the stage vertically when it fits the outer's
// content area, and collapses to 0 when it doesn't (enabling natural
// top-anchored scroll).
const stageCss = css`
  display: block;
  width: 100%;
  overflow: hidden;
  position: relative;
  margin: auto;
  flex-shrink: 0;
`;

const innerCss = css`
  display: block;
  width: ${PRESENTER_SLIDE_DESIGN_WIDTH}px;
  transform-origin: left top;
`;

export const PresenterSlide = ({
  frameRef,
  isCurrent,
  slide,
  ariaLabel,
}: PresenterSlideProps) => {
  const { t } = useTranslation();
  const innerRef = useRef<HTMLDivElement>(null);

  const fit = useFitScale(innerRef, frameRef);

  const outerStyle: React.CSSProperties = {
    width: fit ? `${fit.outerWidth}px` : undefined,
    opacity: fit && isCurrent ? 1 : 0,
    visibility: isCurrent ? 'visible' : 'hidden',
    pointerEvents: isCurrent ? 'auto' : 'none',
  };

  const stageStyle: React.CSSProperties = {
    height: fit ? `${fit.stageHeight}px` : undefined,
  };

  const innerStyle: React.CSSProperties = {
    transform: fit ? `scale(${fit.scale})` : 'none',
  };

  return (
    <Box
      $css={outerCss}
      style={outerStyle}
      role="group"
      aria-roledescription={t('slide')}
      aria-label={ariaLabel ?? t('Presenter slide')}
      aria-hidden={!isCurrent}
    >
      <Box $css={stageCss} style={stageStyle}>
        <Box ref={innerRef} $css={innerCss} style={innerStyle}>
          {slide.kind === 'title' ? (
            <PresenterTitleSlide title={slide.title} />
          ) : (
            <PresenterSlideContent blocks={slide.blocks} />
          )}
        </Box>
      </Box>
    </Box>
  );
};
