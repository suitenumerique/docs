import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { User, avatarUrlFromName } from '@/features/auth';
import { Doc, useProviderStore } from '@/features/docs/doc-management';
import { useDocAccesses } from '@/features/docs/doc-share/api/useDocAccesses';

import { DocsThreadStore } from '../api/DocsThreadStore';
import { DocsThreadStoreAuth } from '../api/DocsThreadStoreAuth';
import { useThreadStore } from '../stores/useThreadStore';

export function useComments(
  docId: Doc['id'],
  canComment: boolean,
  user: User | null | undefined,
) {
  const { provider } = useProviderStore();
  const { t } = useTranslation();
  const { themeTokens } = useCunninghamTheme();
  const { setThreadStore } = useThreadStore();
  const { data: config } = useConfig();
  const { data: accesses } = useDocAccesses({ docId });

  const threadStore = useMemo(() => {
    return new DocsThreadStore(
      docId,
      provider?.awareness ?? undefined,
      new DocsThreadStoreAuth(
        encodeURIComponent(user?.full_name || ''),
        canComment,
        config?.REACTIONS_MAX_PER_COMMENT ?? 0,
      ),
      provider?.doc,
    );
  }, [
    docId,
    canComment,
    provider?.awareness,
    provider?.doc,
    user?.full_name,
    config?.REACTIONS_MAX_PER_COMMENT,
  ]);

  useEffect(() => {
    if (canComment) {
      setThreadStore(threadStore);
    }

    return () => {
      if (canComment) {
        setThreadStore(undefined);
      }
    };
  }, [threadStore, setThreadStore, canComment]);

  useEffect(() => {
    return () => {
      threadStore?.destroy();
    };
  }, [threadStore]);

  const resolveUsers = useCallback(
    async (userIds: string[]) => {
      // Legacy comments identify authors by name, not by user id. Only
      // resolve an unambiguous name; unknown authors keep a stable fallback.
      const knownUsers = new Map<string, User>();
      if (user) {
        knownUsers.set(user.id, user);
      }
      accesses?.forEach(({ user: author }) => {
        if (author) {
          knownUsers.set(author.id, author);
        }
      });
      return Promise.resolve(
        userIds.map((encodedURIUserId) => {
          const fullName = decodeURIComponent(encodedURIUserId);
          const matches = Array.from(knownUsers.values()).filter(
            (author) => author.full_name === fullName,
          );
          const authorId = matches.length === 1 ? matches[0].id : undefined;

          return {
            id: encodedURIUserId,
            username:
              fullName ||
              t('Anonymous', {
                description: 'Display name of a user without a known name',
              }),
            avatarUrl: avatarUrlFromName(
              fullName,
              themeTokens?.font?.families?.base,
              authorId,
            ),
          };
        }),
      );
    },
    [t, themeTokens?.font?.families?.base, user, accesses],
  );

  return { threadStore, resolveUsers };
}
