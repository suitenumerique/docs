import { useRouter } from 'next/router';

import { Box, SeparatedSection } from '@/components';

import { LeftPanelTargetFilters } from './LefPanelTargetFilters';

export const LeftPanelContent = () => {
  const router = useRouter();
  const isHome = router.pathname === '/';

  return (
    <Box $width="100%">
      {isHome && (
        <SeparatedSection>
          <LeftPanelTargetFilters />
        </SeparatedSection>
      )}
    </Box>
  );
};
