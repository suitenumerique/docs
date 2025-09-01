import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';

import { useCreateChildDoc } from '../api';
import { Doc } from '../types';

export const useCreateChildDocTree = (parentId?: string) => {
  const treeContext = useTreeContext<Doc>();
  const router = useRouter();

  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (createdDoc) => {
      const newDoc = {
        ...createdDoc,
        children: [],
        childrenCount: 0,
        parentId: parentId ?? undefined,
      };
      treeContext?.treeData.addChild(parentId || null, newDoc);

      router.push(`/docs/${newDoc.id}`);
      treeContext?.treeData.setSelectedNode(createdDoc);
    },
  });

  return () => {
    if (!parentId) {
      return null;
    }

    createChildDoc({
      parentId,
    });
  };
};
