import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';
import { User, avatarUrlFromName } from '@/features/auth';
import { useEditorStore } from '@/features/docs/doc-editor/stores';
import { Doc, useProviderStore } from '@/features/docs/doc-management';
import { useConfig } from '@/core';

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
  const { setThreadStore } = useEditorStore();
  const { data: config } = useConfig();

  const threadStore = useMemo(() => {
    return new DocsThreadStore(
      docId,
      provider?.awareness ?? undefined,
      new DocsThreadStoreAuth(
        encodeURIComponent(user?.full_name || ''),
        canComment,
        config?.REACTIONS_MAX_PER_COMMENT ?? 0,
      ),
    );
  }, [
    docId,
    canComment,
    provider?.awareness,
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
