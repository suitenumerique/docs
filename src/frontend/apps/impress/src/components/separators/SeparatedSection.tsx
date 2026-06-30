import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box, BoxType } from '../Box';

type SeparatedSectionProps = BoxType & {
  showSeparator?: 'top' | 'bottom' | boolean;
};

export const SeparatedSection = ({
  showSeparator = true,
  children,
  ...boxProps
}: PropsWithChildren<SeparatedSectionProps>) => {
  return (
    <Box
      $width="100%"
      $padding={{ vertical: 'sm', horizontal: '0' }}
      {...boxProps}
      $css={css`
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
