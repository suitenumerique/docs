import { useQuery } from '@tanstack/react-query';

import {
  APIError,
  CollaborationTarget,
  UseQueryOptionsAPI,
  fetchCollaborationAPI,
} from '@/api';
import { useCollaborationTarget } from '@/core/config/hooks/useCollaborationUrl';

import { APIChangeset, DocVersion } from '../types';

export type DocVersionParam = {
  docId: string;
  versionId: DocVersion['id'];
};

/**
 * The document as it stood at the end of a version.
 *
 * `changeset` renders it from a time-zero baseline, so this is the whole
 * document at that moment and not a diff — which is what the preview needs, and
 * what makes it readable with the same base64 decoding as any other snapshot.
 *
 * `activity?ydoc=true` would answer with one document at the newest entry plus a
 * projection per entry, which is the right shape for annotating a timeline and
 * the wrong one for showing a single point in it.
 */
const getDocVersion = async (
  target: CollaborationTarget,
  { docId, versionId }: DocVersionParam,
): Promise<APIChangeset> =>
  fetchCollaborationAPI<APIChangeset>(target, 'changeset', docId, {
    query: { to: versionId, ydoc: true },
  });

export const KEY_DOC_VERSION = 'doc-version';

export function useDocVersion(
  params: DocVersionParam,
  queryConfig?: Omit<UseQueryOptionsAPI<APIChangeset>, 'queryKey' | 'queryFn'>,
) {
  const target = useCollaborationTarget();

  return useQuery<APIChangeset, APIError, APIChangeset>({
    // `target` belongs in the key: it arrives with the configuration, so a
    // query started before it resolved must not be reused after
    queryKey: [KEY_DOC_VERSION, params, target],
    queryFn: () => getDocVersion(target as CollaborationTarget, params),
    enabled: !!target,
    ...queryConfig,
  });
}
