import { useEffect, useMemo } from 'react';

import { User } from '@/features/auth';
import { Doc, useProviderStore } from '@/features/docs/doc-management';

import { DocsThreadStore } from './DocsThreadStore';
import { DocsThreadStoreAuth } from './DocsThreadStoreAuth';

export function useComments(
  docId: Doc['id'],
  canComment: boolean,
  user: User | null | undefined,
) {
  const { provider } = useProviderStore();
  const threadStore = useMemo(() => {
    return new DocsThreadStore(
      docId,
      provider?.awareness ?? undefined,
      new DocsThreadStoreAuth(
        encodeURIComponent(user?.full_name || ''),
        canComment,
      ),
    );
  }, [docId, canComment, provider?.awareness, user?.full_name]);

  useEffect(() => {
    return () => {
      threadStore?.destroy();
    };
  }, [threadStore]);

  return threadStore;
}
