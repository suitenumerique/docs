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
  const { spacingsTokens, contextualTokens } = useCunninghamTheme();

  return (
    <Box
      $css={css`
        width: 100%;
        padding: ${spacingsTokens['sm']} 0;
        ${showSeparator &&
        css`
          border-bottom: 1px solid
            ${contextualTokens['border']['surface']['primary']};
        `}
      `}
    >
      {children}
    </Box>
  );
};
