import { Loader } from '@gouvfr-lasuite/cunningham-react';
import { createGlobalStyle, css } from 'styled-components';

import { Box } from '@/components';

const DocsGridLoaderStyle = createGlobalStyle`
  body, main {
    overflow: hidden!important;
    overflow-y: hidden!important;
  }
`;

type DocsGridLoaderProps = {
  isLoading: boolean;
};

export const DocsGridLoader = ({ isLoading }: DocsGridLoaderProps) => {
  if (!isLoading) {
    return null;
  }

  return (
    <>
      <DocsGridLoaderStyle />
      <Box
        data-testid="grid-loader"
        $align="center"
        $justify="center"
        $height="100%"
        $width="100%"
        $background="rgba(255, 255, 255, 0.5)"
        $zIndex={998}
        $position="absolute"
        className="--docs--doc-grid-loader"
        $css={css`
          pointer-events: none;
        `}
      >
        <Loader />
      </Box>
    </>
  );
};
