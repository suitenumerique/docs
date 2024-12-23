import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';

type Props = {
  showSeparator?: boolean;
};

export const SeparatedSection = ({
  showSeparator = true,
  children,
}: PropsWithChildren<Props>) => {
  const theme = useCunninghamTheme();
  const colors = theme.colorsTokens();
  const spacings = theme.spacingsTokens();
  return (
    <Box
      $css={css`
        width: 100%;
        padding: ${spacings['sm']} 0;
        ${showSeparator &&
        css`
          border-bottom: 1px solid ${colors?.['greyscale-200']};
        `}
      `}
    >
      {children}
    </Box>
  );
};
