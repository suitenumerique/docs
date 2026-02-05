import { CSSProperties, PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { tokens, useCunninghamTheme } from '@/cunningham';

type ColorToken = keyof typeof tokens.themes.default.globals.colors;

export interface OnboardingStepIconProps {
  size?: string;
  colorToken?: ColorToken;
  color?: CSSProperties['color'];
}

export const OnboardingStepIcon = ({
  size = '32px',
  colorToken = 'gray-550',
  color: colorCss,
  children,
}: PropsWithChildren<OnboardingStepIconProps>) => {
  const { colorsTokens } = useCunninghamTheme();
  const color =
    colorCss ??
    colorsTokens[colorToken] ??
    colorsTokens['gray-550'] ??
    'currentColor';

  return (
    <Box
      $css={css`
        width: ${size};
        height: ${size};
        flex: 0 0 ${size};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${color};

        svg {
          width: 24px;
          height: 24px;
          display: block;
        }
      `}
    >
      {children}
    </Box>
  );
};
