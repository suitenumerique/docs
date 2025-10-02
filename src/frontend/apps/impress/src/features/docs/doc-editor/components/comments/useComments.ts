import { useEffect, useMemo } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import { User } from '@/features/auth';
import { Doc, useProviderStore } from '@/features/docs/doc-management';

import { DocsThreadStore } from './DocsThreadStore';
import { DocsThreadStoreAuth } from './DocsThreadStoreAuth';

export function useComments(doc: Doc, user: User | null | undefined) {
  const { provider } = useProviderStore();
  const threadStore = useMemo(() => {
    return new DocsThreadStore(
      doc.id,
      (provider?.awareness ?? undefined) as Awareness | undefined,
      new DocsThreadStoreAuth(
        encodeURIComponent(user?.full_name || ''),
        doc.abilities.comment,
      ),
    );
  }, [doc.id, doc.abilities.comment, provider?.awareness, user?.full_name]);

  useEffect(() => {
    return () => {
      threadStore?.destroy();
    };
  }, [threadStore]);

  return threadStore;
}
