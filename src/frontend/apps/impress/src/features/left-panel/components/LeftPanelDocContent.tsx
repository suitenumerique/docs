import { useTreeContext } from '@gouvfr-lasuite/ui-kit';

import { Box } from '@/components';
import { Doc, useDocStore } from '@/docs/doc-management';
import { DocTree } from '@/features/docs/doc-tree/components/DocTree';

export const LeftPanelDocContent = () => {
  const { currentDoc } = useDocStore();

  const tree = useTreeContext<Doc>();

  if (!currentDoc || !tree) {
    return null;
  }

  return (
    <Box
      $flex={1}
      $width="100%"
      $css="width: 100%; overflow-y: auto; overflow-x: hidden;"
      className="--docs--left-panel-doc-content"
    >
      {tree.initialTargetId && (
        <DocTree initialTargetId={tree.initialTargetId} />
      )}
    </Box>
  );
};
