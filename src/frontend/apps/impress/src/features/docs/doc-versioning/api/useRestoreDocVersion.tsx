import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, CollaborationTarget, fetchCollaborationAPI } from '@/api';
import { useCollaborationTarget } from '@/core/config/hooks/useCollaborationUrl';

import { DocVersion } from '../types';

import { KEY_DOC_ACTIVITY } from './useDocActivity';

export type RestoreDocVersionParam = {
  docId: string;
  versionId: DocVersion['id'];
};

/**
 * Put the document back as it was at the end of a version, by asking the
 * collaboration server to undo everything that happened after it.
 *
 * The rollback is applied where the document lives rather than in this tab: the
 * server appends the undoing change to the room, so every open editor receives
 * it over its connection the way it receives any other change. A client-side
 * undo would have had to be applied here and pushed, which is the same thing
 * with a race in it.
 *
 * `from` is one millisecond past the end of the chosen version, so the version
 * itself survives and everything after it is undone. It is also what keeps this
 * inside what the user may touch: unlike a read, a rollback is refused rather
 * than trimmed if it reaches further back than the history they were granted —
 * and every moment they can name here is one the server showed them.
 *
 * Nothing is lost. The undo is a change like any other, so the state it replaced
 * stays in the history and can be restored again from the same panel.
 */
const restoreDocVersion = async (
  target: CollaborationTarget,
  { docId, versionId }: RestoreDocVersionParam,
) =>
  fetchCollaborationAPI(target, 'rollback', docId, {
    method: 'POST',
    body: { from: Number(versionId) + 1 },
  });

export function useRestoreDocVersion({
  onSuccess,
}: { onSuccess?: () => void } = {}) {
  const queryClient = useQueryClient();
  const target = useCollaborationTarget();

  return useMutation<void, APIError, RestoreDocVersionParam>({
    mutationFn: async (params) => {
      await restoreDocVersion(target as CollaborationTarget, params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_DOC_ACTIVITY] });
      onSuccess?.();
    },
  });
}
