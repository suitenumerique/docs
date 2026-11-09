import { UseMutationOptions, useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type MentionUser = {
  docId: string;
  /** Id of the block containing the mention, used for the email deeplink. */
  anchorId: string;
  mentionedUserId: string;
};

export type MentionUserResponse = {
  id: string;
  document_id: string;
  anchor_id: string;
  thread_id: string | null;
  mentioned_user_id: string;
  mentioned_by_user_id: string;
  created_at: string;
  notified_at: string | null;
};

export const mentionUser = async ({
  docId,
  anchorId,
  mentionedUserId,
}: MentionUser): Promise<MentionUserResponse> => {
  const response = await fetchAPI(`documents/${docId}/mention/`, {
    method: 'POST',
    body: JSON.stringify({
      anchor_id: anchorId,
      mentioned_user_id: mentionedUserId,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to mention the user',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<MentionUserResponse>;
};

type UseMentionUserOptions = UseMutationOptions<
  MentionUserResponse,
  APIError,
  MentionUser
>;

/**
 * Records the mention of a user in the doc body, the backend then notifies
 * the user by email.
 */
export function useMentionUser(options?: UseMentionUserOptions) {
  return useMutation<MentionUserResponse, APIError, MentionUser>({
    mutationFn: mentionUser,
    ...options,
  });
}
