import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';
import { User, avatarUrlFromName } from '@/features/auth';
import { Doc, useProviderStore } from '@/features/docs/doc-management';

import { DocsThreadStore } from './DocsThreadStore';
import { DocsThreadStoreAuth } from './DocsThreadStoreAuth';

export function useComments(
  docId: Doc['id'],
  canComment: boolean,
  user: User | null | undefined,
) {
  const { provider } = useProviderStore();
  const { t } = useTranslation();
  const { themeTokens } = useCunninghamTheme();

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

  const resolveUsers = useCallback(
    async (userIds: string[]) => {
      return Promise.resolve(
        userIds.map((encodedURIUserId) => {
          const fullName = decodeURIComponent(encodedURIUserId);

          return {
            id: encodedURIUserId,
            username: fullName || t('Anonymous'),
            avatarUrl: avatarUrlFromName(
              fullName,
              themeTokens?.font?.families?.base,
            ),
          };
        }),
      );
    },
    [t, themeTokens?.font?.families?.base],
  );

  return { threadStore, resolveUsers };
}
