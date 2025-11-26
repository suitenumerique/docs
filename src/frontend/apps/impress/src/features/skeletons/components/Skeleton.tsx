import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { css, keyframes } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useSkeletonStore } from '@/features/skeletons';

const FADE_DURATION_MS = 250;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

export const Skeleton = ({ children }: PropsWithChildren) => {
  const { isSkeletonVisible } = useSkeletonStore();
  const { colorsTokens } = useCunninghamTheme();
  const [isVisible, setIsVisible] = useState(isSkeletonVisible);
  const [isFadingOut, setIsFadingOut] = useState(true);
  const timeoutVisibleRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSkeletonVisible) {
      setIsVisible(true);
      setIsFadingOut(false);
    } else {
      setIsFadingOut(true);
      if (!timeoutVisibleRef.current) {
        timeoutVisibleRef.current = setTimeout(() => {
          setIsVisible(false);
        }, FADE_DURATION_MS * 2);
      }
    }

    return () => {
      if (timeoutVisibleRef.current) {
        clearTimeout(timeoutVisibleRef.current);
        timeoutVisibleRef.current = null;
      }
    };
  }, [isSkeletonVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      className="--docs--skeleton"
      $align="center"
      $width="100%"
      $height="100%"
      $background={colorsTokens['gray-000']}
      $css={css`
        position: absolute;
        inset: 0;
        z-index: 999;
        overflow: hidden;
        will-change: opacity;
        animation: ${isFadingOut && fadeOut} ${FADE_DURATION_MS}ms ease-in-out
          forwards;
      `}
    >
      {children}
    </Box>
  );
};
