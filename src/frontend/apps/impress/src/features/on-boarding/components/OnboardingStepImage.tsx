import { css } from 'styled-components';

import { Box } from '@/components';

export interface OnboardingStepImageProps {
  src: string;
  alt: string;
}

export const OnboardingStepImage = ({ src, alt }: OnboardingStepImageProps) => {
  return (
    <Box
      $css={css`
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          max-width: 100%;
          height: auto;
          display: block;
        }
      `}
    >
      <img src={src} alt={alt} />
    </Box>
  );
};
