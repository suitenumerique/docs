import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box, BoxType } from './Box';
import { Card } from './Card';

const FLOATING_STYLES = css`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 10; // Under editor select box but above other elements (e.g., doc title, suggestion menu)
  isolation: isolate;
  min-height: 68px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    mask-image: linear-gradient(180deg, black 50%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, black 50%, transparent 100%);
  }

  > * {
    position: relative;
    z-index: 1;
  }
`;

export const FloatingBar = ({
  children,
  ...props
}: PropsWithChildren<BoxType>) => {
  return (
    <Box
      as="header"
      className="--docs--floating-bar"
      data-testid="floating-bar"
      $direction="row"
      $justify="space-between"
      $align="flex-start"
      $padding="sm"
      $css={FLOATING_STYLES}
      {...props}
    >
      {children}
    </Box>
  );
};

export const CardFloatingBar = ({
  children,
  ...props
}: PropsWithChildren<BoxType>) => {
  return (
    <Card
      className="--docs--card-floating-bar"
      $direction="row"
      $css={css`
        padding: var(--c--globals--spacings--xxxs);
        align-items: center;
        gap: var(--c--globals--spacings--xxxs);
        border-radius: var(--c--globals--spacings--xs);
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      `}
      {...props}
    >
      {children}
    </Card>
  );
};
