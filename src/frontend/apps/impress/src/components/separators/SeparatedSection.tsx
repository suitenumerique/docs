import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';

type SeparatedSectionProps = {
  showSeparator?: 'top' | 'bottom' | boolean;
};

export const SeparatedSection = ({
  showSeparator = true,
  children,
}: PropsWithChildren<SeparatedSectionProps>) => {
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Box
      $css={css`
        width: 100%;
        padding: ${spacingsTokens['sm']} 0;
        ${showSeparator === 'top' || showSeparator === true
          ? css`
              border-top: 1px solid
                var(--c--contextuals--border--surface--primary);
            `
          : ''}
        ${showSeparator === 'bottom' || showSeparator === true
          ? css`
              border-bottom: 1px solid
                var(--c--contextuals--border--surface--primary);
            `
          : ''}
      `}
    >
      {children}
    </Box>
  );
};
