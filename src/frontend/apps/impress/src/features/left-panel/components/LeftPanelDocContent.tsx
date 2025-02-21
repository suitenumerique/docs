import { useEffect } from 'react';

import { Box } from '@/components';
import { useTreeStore } from '@/components/common/tree/treeStore';
import { useDocStore } from '@/features/docs/doc-management';
import { DocTree } from '@/features/docs/doc-tree/components/DocTree';
import { useDocRootTreeStore } from '@/features/docs/doc-tree/stores/useDocRootTree';

export const LeftPanelDocContent = () => {
  const { rootId } = useDocRootTreeStore();
  const { currentDoc, setCurrentDoc } = useDocStore();
  const { reset } = useTreeStore();

  useEffect(() => {
    return () => {
      setCurrentDoc(undefined);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
