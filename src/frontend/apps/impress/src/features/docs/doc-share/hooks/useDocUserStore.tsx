import { type User as BlockNoteUser, createUserStore } from '@blocknote/core';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';
import { type User, avatarUrlFromName, useAuth } from '@/features/auth';

import { useDocAccesses } from '../api/useDocAccesses';

import { userColorsForId } from './userColors';

/**
 * Builds a BlockNote user store for a document from its accesses and the
 * current user.
 *
 * Collaboration features (versioning, suggestions, attributions) only store
 * raw author ids in the document. This store resolves those ids into user
 * information so their labels can be displayed. Authors that are not known
 * anymore (e.g. they no longer have access to the document, or edited
 * anonymously) stay unresolved and are displayed with their raw id.
 */
export const useDocUserStore = (docId: string) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { themeTokens } = useCunninghamTheme();
  const { data: accesses } = useDocAccesses({ docId });

  const fontFamily = themeTokens?.font?.families?.base;

  /**
   * Users known from the document accesses. The resolver reads from this map
   * so the store does not need to be recreated when the accesses change.
   */
  const knownUsersRef = useRef(new Map<string, BlockNoteUser>());

  const userStore = useMemo(
    () =>
      createUserStore<BlockNoteUser>((userIds) =>
        Promise.resolve(
          userIds
            .map((id) => knownUsersRef.current.get(id))
            .filter((docUser): docUser is BlockNoteUser => !!docUser),
        ),
      ),
    [],
  );

  useEffect(() => {
    const toBlockNoteUser = (docUser: User): BlockNoteUser => {
      const name = docUser.full_name || docUser.short_name || docUser.email;

      return {
        id: docUser.id,
        username: name || t('Anonymous'),
        avatarUrl: avatarUrlFromName(name, fontFamily, docUser.id),
        ...userColorsForId(docUser.id),
      };
    };

    const knownUsers = new Map<string, BlockNoteUser>();

    if (user) {
      knownUsers.set(user.id, toBlockNoteUser(user));
    }

    accesses?.forEach((access) => {
      const docUser = access.user as User | null;

      if (!docUser) {
        return;
      }

      knownUsers.set(docUser.id, toBlockNoteUser(docUser));
    });

    knownUsersRef.current = knownUsers;

    if (knownUsers.size > 0) {
      userStore.setUser(Array.from(knownUsers.values()));
    }
  }, [accesses, user, userStore, t, fontFamily]);

  return userStore;
};
