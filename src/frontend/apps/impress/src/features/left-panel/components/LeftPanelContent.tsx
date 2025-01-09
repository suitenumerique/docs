import { useRouter } from 'next/router';
import { css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';

import { LeftPanelTargetFilters } from './LefPanelTargetFilters';
import { LeftPanelDocContent } from './LeftPanelDocContent';
import { LeftPanelFavorites } from './LeftPanelFavorites';

export const LeftPanelContent = () => {
  const router = useRouter();
  const isHome = router.pathname === '/';
  const isDoc = router.pathname === '/docs/[id]';

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
            <SeparatedSection showSeparator={false}>
              <LeftPanelTargetFilters />
            </SeparatedSection>
          </Box>
          <Box
            $flex={1}
            $width="100%"
            $css="overflow-y: auto; overflow-x: hidden;"
          >
            <LeftPanelFavorites />
          </Box>
        </>
      )}
      {isDoc && <LeftPanelDocContent />}
    </>
  );
};
