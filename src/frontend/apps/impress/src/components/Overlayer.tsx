import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box, BoxType } from '.';

type OverlayerProps = PropsWithChildren<{
  isOverlay: boolean;
}> &
  Partial<BoxType>;

export const Overlayer = ({
  children,
  className,
  $css,
  isOverlay,
  ...props
}: OverlayerProps) => {
  if (!isOverlay) {
    return children;
  }

  return (
    <Box
      className={`--docs--overlayer ${className || ''}`}
      $opacity="0.4"
      $zIndex="10"
      $css={css`
        ${$css}
        pointer-events: none;
      `}
      {...props}
    >
      {children}
    </Box>
  );
};
