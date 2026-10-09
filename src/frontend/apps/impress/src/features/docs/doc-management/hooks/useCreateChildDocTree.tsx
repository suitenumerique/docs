import { useTreeContext } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/navigation';

import { useCreateChildDoc } from '../api';
import { Doc } from '../types';

import { useLinkChildDocInParent } from './useLinkChildDocInParent';

export const useCreateChildDocTree = (parentId?: string) => {
  const treeContext = useTreeContext<Doc>();
  const router = useRouter();
  const linkChildDocInParent = useLinkChildDocInParent();

  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: async (createdDoc) => {
      const newDoc = {
        ...createdDoc,
        children: [],
        childrenCount: 0,
        parentId: parentId ?? undefined,
      };
      treeContext?.treeData.addChild(parentId || null, newDoc);

      if (parentId) {
        await linkChildDocInParent(parentId, newDoc.id, 'cursor');
      }

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
