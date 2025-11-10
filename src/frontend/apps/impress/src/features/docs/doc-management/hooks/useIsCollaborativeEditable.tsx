import { useEffect, useRef, useState } from 'react';

import { useConfig } from '@/core';
import { useIsOffline } from '@/features/service-worker';

import { KEY_CAN_EDIT, useDocCanEdit } from '../api/useDocCanEdit';
import { useProviderStore } from '../stores';
import { Doc, LinkReach, LinkRole } from '../types';

export const useIsCollaborativeEditable = (doc: Doc) => {
  const { isConnected } = useProviderStore();
  const { data: conf } = useConfig();

  const docIsPublic =
    doc.computed_link_reach === LinkReach.PUBLIC &&
    doc.computed_link_role === LinkRole.EDITOR;
  const docIsAuth =
    doc.computed_link_reach === LinkReach.AUTHENTICATED &&
    doc.computed_link_role === LinkRole.EDITOR;
  const docHasMember =
    doc.nb_accesses_direct > 1 || doc.nb_accesses_ancestors > 1;
  const isUserReader = !doc.abilities.partial_update;
  const isShared = docIsPublic || docIsAuth || docHasMember;
  const { isOffline } = useIsOffline();
  const _isEditable = isUserReader || isConnected || !isShared || isOffline;
  const [isEditable, setIsEditable] = useState(true);
  const [isLoading, setIsLoading] = useState(!_isEditable);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const { data: editingRight, isLoading: isLoadingCanEdit } = useDocCanEdit(
    doc.id,
    {
      enabled: !_isEditable,
      queryKey: [KEY_CAN_EDIT, doc.id],
      staleTime: 0,
    },
  );

  useEffect(() => {
    if (isLoadingCanEdit || _isEditable || !editingRight) {
      return;
    }

    // Connection to the WebSocket can take some time, so we set a timeout to ensure the loading state is cleared after a reasonable time.
    timeout.current = setTimeout(() => {
      setIsEditable(editingRight.can_edit);
      setIsLoading(false);
    }, 1500);

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [editingRight, isLoadingCanEdit, _isEditable]);

  useEffect(() => {
    if (!_isEditable) {
      return;
    }

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    setIsEditable(true);
    setIsLoading(false);
  }, [_isEditable]);

  if (!conf?.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY) {
    return {
      isEditable: true,
      isLoading: false,
    };
  }

  return {
    isEditable,
    isLoading,
  };
};
