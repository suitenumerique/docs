import { Gaufre } from '@gouvfr-lasuite/integration';
import '@gouvfr-lasuite/integration/dist/css/gaufre.css';
import Script from 'next/script';
import React from 'react';
import { createGlobalStyle } from 'styled-components';

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

  return (
    <>
      <Script
        src="https://integration.lasuite.numerique.gouv.fr/api/v1/gaufre.js"
        strategy="lazyOnload"
        id="lasuite-gaufre-script"
      />
      <GaufreStyle />
      <Gaufre variant="small" />
    </>
  );
};
