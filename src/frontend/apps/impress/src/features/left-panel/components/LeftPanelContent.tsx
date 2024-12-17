import { useRouter } from 'next/router';
import { css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';

import { LeftPanelTargetFilters } from './LefPanelTargetFilters';
import { LeftPanelFavorites } from './LeftPanelFavorites';

export const LeftPanelContent = () => {
  const router = useRouter();
  const isHome = router.pathname === '/';

  return (
    <>
      {isHome && (
        <>
          <Box
            $width="100%"
            $css={css`
              flex: 0 0 auto;
            `}
          >
            <SeparatedSection>
              <LeftPanelTargetFilters />
            </SeparatedSection>
          </Box>
          <Box $flex={1} $css="overflow-y: auto; overflow-x: hidden;">
            <SeparatedSection showSeparator={false}>
              <LeftPanelFavorites />
            </SeparatedSection>
          </Box>
        </>
      )}
    </>
  );
};
