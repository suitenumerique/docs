import { Box } from '@/components';
import { useDocStore } from '@/features/docs/doc-management';
import { DocTree } from '@/features/docs/doc-tree/components/DocTree';
import { useDocRootTreeStore } from '@/features/docs/doc-tree/stores/useDocRootTree';

export const LeftPanelDocContent = () => {
  const { rootId } = useDocRootTreeStore();
  const { currentDoc } = useDocStore();

  if (!currentDoc) {
    return null;
  }

  return (
    <Box
      $flex={1}
      $width="100%"
      $css="width: 100%; overflow-y: auto; overflow-x: hidden;"
    >
      {rootId && <DocTree docId={rootId} />}
    </Box>
  );
};
