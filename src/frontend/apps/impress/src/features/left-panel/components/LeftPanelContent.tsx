import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/router';
import { css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';
import { Doc } from '@/features/docs/doc-management';
import { useDocStore } from '@/features/docs/doc-management/stores/useDocStore';
import { DocTree } from '@/features/docs/doc-tree/components/DocTree';
import { TreeSkeleton } from '@/features/skeletons/components/TreeSkeleton';

import { LeftPanelTargetFilters } from './LefPanelTargetFilters';
import { LeftPanelFavorites } from './LeftPanelFavorites';

export const LeftPanelContent = () => {
  const router = useRouter();
  const isHome = router.pathname === '/';
  const isDoc = router.pathname === '/docs/[id]';

  if (isHome) {
    return (
      <>
        <Box
          $width="100%"
          $css={css`
            flex: 0 0 auto;
          `}
          className="--docs--home-left-panel-content"
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
    );
  }

  if (isDoc) {
    return <LeftPanelDocContent />;
  }

  return null;
};

const LeftPanelDocContent = () => {
  const tree = useTreeContext<Doc>();
  const { currentDoc } = useDocStore();

  return (
    <Box
      $flex={1}
      $width="100%"
      $css="width: 100%; overflow-y: auto; overflow-x: hidden;"
      className="--docs--left-panel-doc-content"
    >
      {tree && currentDoc ? (
        <DocTree currentDoc={currentDoc} />
      ) : (
        <TreeSkeleton />
      )}
    </Box>
  );
};
