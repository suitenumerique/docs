import { useTreeContext } from '@gouvfr-lasuite/ui-kit';

import { Box } from '@/components';
import { Doc, useDocStore } from '@/docs/doc-management';
import { DocTree } from '@/docs/doc-tree/';
import { TreeSkeleton } from '@/features/skeletons/components/TreeSkeleton';

export const LeftPanelDocContent = () => {
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
