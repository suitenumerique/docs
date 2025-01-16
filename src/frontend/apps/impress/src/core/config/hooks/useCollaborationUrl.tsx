import { useConfig } from '../api';

export const useCollaborationUrl = (room?: string): string | undefined => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/ws/`
      : '');

  const wsUrl = `${base}?room=${encodeURIComponent(room)}`;

  return wsUrl;
};
