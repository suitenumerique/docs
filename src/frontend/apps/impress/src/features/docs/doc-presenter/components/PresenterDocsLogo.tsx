import { css } from 'styled-components';

import { Box } from '@/components';

import LogoDocsMonoSVG from '../assets/logo-docs-mono.svg';

const logoCss = css`
  width: 80px;
  height: 32px;
  pointer-events: none;

  svg {
    display: block;
    width: 80px;
    height: 32px;
  }
`;

export const PresenterDocsLogo = () => (
  <Box $css={logoCss} aria-hidden="true">
    <LogoDocsMonoSVG />
  </Box>
);
