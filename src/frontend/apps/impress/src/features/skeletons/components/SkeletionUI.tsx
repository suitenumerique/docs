import { css, keyframes } from 'styled-components';

import { Box, BoxType } from '@/components/Box';
import { useCunninghamTheme } from '@/cunningham/useCunninghamTheme';

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

type SkeletonLineProps = Partial<BoxType>;

type SkeletonCircleProps = Partial<BoxType>;

export const SkeletonLine = ({ $css, ...props }: SkeletonLineProps) => {
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $width="100%"
      $height="16px"
      $css={css`
        background: linear-gradient(
          90deg,
          ${colorsTokens['black-050']} 0%,
          ${colorsTokens['black-100']} 50%,
          ${colorsTokens['black-050']} 100%
        );
        background-size: 1000px 100%;
        animation: ${shimmer} 2s infinite linear;
        border-radius: 4px;
        ${$css}
      `}
      {...props}
    />
  );
};

export const SkeletonCircle = ({ $css, ...props }: SkeletonCircleProps) => {
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $width="32px"
      $height="32px"
      $css={css`
        background: linear-gradient(
          90deg,
          ${colorsTokens['black-050']} 0%,
          ${colorsTokens['black-100']} 50%,
          ${colorsTokens['black-050']} 100%
        );
        background-size: 1000px 100%;
        animation: ${shimmer} 2s infinite linear;
        border-radius: 50%;
        ${$css}
      `}
      {...props}
    />
  );
};
