import { useMemo } from 'react';

import { Access, Role } from '@/docs/doc-management';
import { KEY_LIST_DOC_ACCESSES, useDocAccesses } from '@/docs/doc-share/api';
import { User } from '@/features/auth';

export type MentionableUser = Pick<User, 'id'> &
  Partial<Pick<User, 'email' | 'short_name'>> & { full_name: string };

export const getMentionableUserName = (user: MentionableUser) =>
  user.full_name || user.short_name || user.email || '';

/**
 * The users of the doc who can be mentioned: the ones with a user account
 * (not the teams) and allowed to comment, the backend rejects the readers.
 * The same user can have several accesses on the ancestors of the doc.
 */
export const getMentionableUsers = (
  accesses: Access[] | undefined,
  search: string,
): MentionableUser[] => {
  const query = search.trim().toLowerCase();
  const users = new Map<string, MentionableUser>();

  accesses?.forEach(({ user, role, max_role }) => {
    if (!user || (max_role ?? role) === Role.READER || users.has(user.id)) {
      return;
    }

    const matches = [user.full_name, user.short_name, user.email].some(
      (value) => value?.toLowerCase().includes(query),
    );

    if (matches) {
      users.set(user.id, user);
    }
  });

  return Array.from(users.values());
};

export const useMentionableUsers = ({
  docId,
  search,
  enabled = true,
}: {
  docId?: string;
  search: string;
  enabled?: boolean;
}) => {
  const params = { docId: docId ?? '' };
  const { data: accesses, isLoading } = useDocAccesses(params, {
    enabled: enabled && !!docId,
    queryKey: [KEY_LIST_DOC_ACCESSES, params],
  });

  const users = useMemo(
    () => (enabled ? getMentionableUsers(accesses, search) : []),
    [accesses, enabled, search],
  );

  return { users, isLoading };
};
