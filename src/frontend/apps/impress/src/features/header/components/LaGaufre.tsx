import { Gaufre } from '@gouvfr-lasuite/integration';
import '@gouvfr-lasuite/integration/dist/css/gaufre.css';
import Script from 'next/script';
import React from 'react';
import { createGlobalStyle } from 'styled-components';
import { GAUFREJS_URL } from '../conf'

import { useCunninghamTheme } from '@/cunningham';

const GaufreStyle = createGlobalStyle`
  .lasuite-gaufre-btn{
    box-shadow: inset 0 0 0 0 !important;
  }
`;

export const LaGaufre = () => {
  const { componentTokens } = useCunninghamTheme();

  if (!componentTokens['la-gaufre']) {
    return null;
  }

  const src = GAUFREJS_URL || "https://integration.lasuite.numerique.gouv.fr/api/v1/gaufre.js"

  return (
    <>
      <Script
        src={src}
        strategy="lazyOnload"
        id="lasuite-gaufre-script"
      />
      <GaufreStyle />
      <Gaufre variant="small" />
    </>
  );
};
