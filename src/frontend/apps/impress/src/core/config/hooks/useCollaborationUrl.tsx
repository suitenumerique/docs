import { useConfig } from '../api';

export const useCollaborationUrl = (room?: string) => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  // The room is appended to the base URL by the provider (y-websocket)
  return (
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? // TODO(yhub): no prod ingress route yet
        `wss://${window.location.host}/collaboration/ws/v1/docs`
      : '')
  );
};
