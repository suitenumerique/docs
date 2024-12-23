import { useConfig } from '../api';

export type CollaborationUrl = {
  wsUrl: string;
  pollUrl: string;
};

export const useCollaborationUrl = (
  room?: string,
): CollaborationUrl | undefined => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/ws/`
      : '');

  const wsUrl = `${base}?room=${room}`;

  let pollUrl = wsUrl.replace('/ws/', '/ws/poll/');
  pollUrl = pollUrl.replace('ws:', 'http:');
  if (pollUrl.includes('wss:')) {
    pollUrl = pollUrl.replace('wss:', 'https:');
  }

  return { wsUrl, pollUrl };
};
