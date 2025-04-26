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
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  return (
    <Box
      $css={css`
        width: 100%;
        padding: ${spacingsTokens['sm']} 0;
        ${showSeparator &&
        css`
          border-bottom: 1px solid ${colorsTokens['greyscale-200']};
        `}
      `}
    >
      {children}
    </Box>
  );
};
