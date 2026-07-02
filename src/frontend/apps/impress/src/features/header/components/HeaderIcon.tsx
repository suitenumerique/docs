import { DotLottie, DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components/Box';

import { useHideOnScroll } from '../hooks/useHideOnScroll';

export const HeaderIcon = () => {
  const isVisible = useHideOnScroll();
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);

  useEffect(() => {
    if (isVisible && dotLottie) {
      dotLottie.play();
    }
  }, [isVisible, dotLottie]);

  return (
    <Box
      $width="32px"
      $height="32px"
      $css={css`
        transition: transform 0.3s ease-in-out;
        ${isVisible
          ? css`
              transform: translateY(0);
            `
          : css`
              transform: translateY(-300%);
            `}
      `}
    >
      <DotLottieReact
        src="/assets/Docs-lottie.json"
        autoplay={false}
        loop={false}
        dotLottieRefCallback={setDotLottie}
        aria-label="Docs animated icon"
      />
    </Box>
  );
};
