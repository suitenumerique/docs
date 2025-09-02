import {
  DefaultThreadStoreAuth,
  RESTYjsThreadStore,
} from '@blocknote/core/comments';
import * as Y from 'yjs';

import { getCSRFToken } from '@/api';
import { baseApiUrl } from '@/api/config';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

export function useComments(
  yDoc: Y.Doc,
  doc: Doc,
  user: User | null | undefined,
) {
  const apiUrl = `${baseApiUrl('1.0')}documents/${doc.id}/comments/`;
  const csrfToken = getCSRFToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRFToken': csrfToken }),
  };

  const threadStore = new RESTYjsThreadStore(
    apiUrl,
    headers,
    yDoc.getMap('threads'),
    new DefaultThreadStoreAuth(user?.id || '', 'editor'),
  );

  return threadStore;
}
