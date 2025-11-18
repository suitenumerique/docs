import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';

import { Box, BoxType } from '.';

export const Card = ({
  children,
  className,
  $css,
  ...props
}: PropsWithChildren<BoxType>) => {
  const { contextualTokens } = useCunninghamTheme();

  return (
    <Box
      className={`--docs--card ${className || ''}`}
      $background="white"
      $radius="4px"
      $css={css`
        border: 1px solid ${contextualTokens['border']['surface']['primary']};
        ${$css}
      `}
      {...props}
    >
      {children}
    </Box>
  );
};
