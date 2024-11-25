import { Loader } from '@openfun/cunningham-react';
import { createGlobalStyle, css } from 'styled-components';

import { Box } from '@/components';
import { HEADER_HEIGHT } from '@/features/header/conf';

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
        $height="calc(100vh - 50px)"
        $width="100%"
        $maxWidth="960px"
        $background="rgba(255, 255, 255, 0.3)"
        $zIndex={998}
        $position="fixed"
        $css={css`
          top: ${HEADER_HEIGHT}px;
        `}
      >
        <Loader />
      </Box>
    </>
  );
};
