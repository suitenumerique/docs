import { useEffect, useMemo } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';
import { useProviderStore } from '@/features/docs/doc-management/stores/useProviderStore';

import { DocsThreadStore } from './DocsThreadStore';
import { DocsThreadStoreAuth } from './DocsThreadStoreAuth';

export function useComments(
  yDoc: Y.Doc,
  doc: Doc,
  user: User | null | undefined,
) {
  const { provider } = useProviderStore();
  const threadStore = useMemo(() => {
    return new DocsThreadStore(
      doc.id,
      yDoc,
      (provider?.awareness ?? undefined) as Awareness | undefined,
      new DocsThreadStoreAuth(
        encodeURIComponent(user?.full_name || ''),
        'editor',
        doc.abilities.comment,
      ),
    );
  }, [
    doc.id,
    doc.abilities.comment,
    yDoc,
    provider?.awareness,
    user?.full_name,
  ]);

  useEffect(() => {
    return () => {
      threadStore?.destroy();
    };
  }, [threadStore]);

  return threadStore;
}
