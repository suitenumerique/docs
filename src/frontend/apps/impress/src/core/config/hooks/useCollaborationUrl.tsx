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

/**
 * y/hub serves the same rooms over two transports, mounted side by side under one prefix:
 * `{prefix}/ws/v1/{org}/{docid}` for the websocket and `{prefix}/ydoc/v1/{org}/{docid}` over
 * plain http. The two providers spell a room differently — y-websocket takes a base url and
 * appends the room name, the http provider takes the org and the docid apart — so this reads
 * the org out of the websocket url and hands back what `HttpProvider` needs.
 *
 * Returns undefined for a url that is not shaped like one. An instance configured with
 * something else then simply has no http fallback, rather than polling an address nobody
 * serves.
 */
export const collaborationHttpTarget = (wsUrl: string) => {
  const match = /^(ws|wss):\/\/(.*)\/ws\/v1\/([^/]+)\/?$/.exec(wsUrl);

  if (!match) {
    return;
  }

  const [, scheme, base, org] = match;

  return {
    serverUrl: `${scheme === 'wss' ? 'https' : 'http'}://${base}`,
    org,
  };
};
