import { useConfig } from '../api';

export const useCollaborationUrl = (room?: string) => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/ws/`
      : '');

  /**
   * The y-websocket provider builds `${serverUrl}/${room}` itself; stripping
   * the trailing slash keeps existing COLLABORATION_WS_URL values (which end
   * with `/`) working unchanged.
   */
  return base.replace(/\/+$/, '');
};
