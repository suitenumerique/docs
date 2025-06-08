import { useEffect, useState } from 'react';

import { useConfig } from '@/core';
import { useIsOffline } from '@/features/service-worker';

import { useProviderStore } from '../stores';
import { Doc, LinkReach } from '../types';

export const useIsCollaborativeEditable = (doc: Doc) => {
  const { isConnected } = useProviderStore();
  const { data: conf } = useConfig();

  const docIsPublic = doc.link_reach === LinkReach.PUBLIC;
  const docIsAuth = doc.link_reach === LinkReach.AUTHENTICATED;
  const docHasMember = doc.nb_accesses_direct > 1;
  const isShared = docIsPublic || docIsAuth || docHasMember;
  const [isEditable, setIsEditable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { isOffline } = useIsOffline();

  /**
   * Connection can take a few seconds
   */
  useEffect(() => {
    const _isEditable = isConnected || !isShared || isOffline;
    setIsLoading(true);

    if (_isEditable) {
      setIsEditable(true);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsEditable(false);
      setIsLoading(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isConnected, isOffline, isShared]);

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
