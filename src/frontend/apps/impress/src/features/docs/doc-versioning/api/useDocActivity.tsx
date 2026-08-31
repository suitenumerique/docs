import { useQuery } from '@tanstack/react-query';

import {
  APIError,
  CollaborationTarget,
  UseQueryOptionsAPI,
  fetchCollaborationAPI,
} from '@/api';
import { useCollaborationTarget } from '@/core/config/hooks/useCollaborationUrl';

import { APIActivity, DocVersion } from '../types';
import { VERSION_GRANULARITY_MS, mergeActivityEntries } from '../utils';

export type DocActivityParam = {
  docId: string;
};

/**
 * The whole timeline in one request, deliberately.
 *
 * `activity` takes a `limit` but no cursor, and the server groups the entire
 * filtered history before applying it — so paging costs a full regrouping per
 * page and saves only the response body, which is three numbers per version.
 * Responses are cached briefly and keyed on every parameter, so asking the same
 * question every time is worth more than asking a smaller one.
 *
 * What comes back is already bounded to what this user may see: the history
 * starts at the moment they were given access to the document, and the server
 * applies that silently rather than refusing the request.
 */
const getDocActivity = async (
  target: CollaborationTarget,
  { docId }: DocActivityParam,
): Promise<DocVersion[]> => {
  const { activity } = await fetchCollaborationAPI<APIActivity>(
    target,
    'activity',
    docId,
    {
      query: {
        group: true,
        groupMaxGap: VERSION_GRANULARITY_MS,
        groupMaxDuration: VERSION_GRANULARITY_MS,
      },
    },
  );

  // ascending from the server, newest first for the panel
  return mergeActivityEntries(activity).reverse();
};

export const KEY_DOC_ACTIVITY = 'doc-activity';

export function useDocActivity(
  params: DocActivityParam,
  queryConfig?: Omit<UseQueryOptionsAPI<DocVersion[]>, 'queryKey' | 'queryFn'>,
) {
  const target = useCollaborationTarget();

  return useQuery<DocVersion[], APIError, DocVersion[]>({
    // `target` belongs in the key: it arrives with the configuration, so a
    // query started before it resolved must not be reused after
    queryKey: [KEY_DOC_ACTIVITY, params, target],
    queryFn: () => getDocActivity(target as CollaborationTarget, params),
    enabled: !!target,
    /**
     * Against the application's three-minute default, which is wrong for this
     * one: the timeline grows while the panel is closed, and opening it is a
     * deliberate request to see the history *now*. Left at the default, a user
     * who edits and reopens the panel is shown the list as it was when they
     * last looked at it.
     *
     * There is little to save by holding it: the collaboration server caches
     * its own answer for a few seconds, so a reopen inside that window costs a
     * round trip and no computation.
     */
    staleTime: 0,
    ...queryConfig,
  });
}
