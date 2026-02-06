import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export interface OnboardingStepIconProps {
  size?: string;
}

export const OnboardingStepIcon = ({
  size = '32px',
  children,
}: PropsWithChildren<OnboardingStepIconProps>) => {
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $css={css`
        width: ${size};
        height: ${size};
        flex: 0 0 ${size};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${colorsTokens['gray-550']};

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
