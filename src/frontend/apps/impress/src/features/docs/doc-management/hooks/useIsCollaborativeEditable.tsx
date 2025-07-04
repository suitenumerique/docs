import { useEffect, useState } from 'react';

import { useConfig } from '@/core';
import { useIsOffline } from '@/features/service-worker';

import { KEY_CAN_EDIT, useDocCanEdit } from '../api/useDocCanEdit';
import { useProviderStore } from '../stores';
import { Doc, LinkReach } from '../types';

export const useIsCollaborativeEditable = (doc: Doc) => {
  const { isConnected } = useProviderStore();
  const { data: conf } = useConfig();

  const docIsPublic = doc.link_reach === LinkReach.PUBLIC;
  const docIsAuth = doc.link_reach === LinkReach.AUTHENTICATED;
  const docHasMember = doc.nb_accesses_direct > 1;
  const isUserReader = !doc.abilities.partial_update;
  const isShared = docIsPublic || docIsAuth || docHasMember;
  const { isOffline } = useIsOffline();
  const _isEditable = isUserReader || isConnected || !isShared || isOffline;
  const [isEditable, setIsEditable] = useState(true);
  const [isLoading, setIsLoading] = useState(!_isEditable);

  const {
    data: { can_edit } = { can_edit: _isEditable },
    isLoading: isLoadingCanEdit,
  } = useDocCanEdit(doc.id, {
    enabled: !_isEditable,
    queryKey: [KEY_CAN_EDIT, doc.id],
    staleTime: 0,
  });

  useEffect(() => {
    if (isLoadingCanEdit) {
      return;
    }

    setIsEditable(can_edit);
    setIsLoading(false);
  }, [can_edit, isLoadingCanEdit]);

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
