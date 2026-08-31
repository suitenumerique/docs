import { CollaborationTarget } from '@/api';

import { useConfig } from '../api';

/**
 * Where the collaboration server's rooms live, independent of which document is
 * being opened. Kept apart so the two hooks below cannot answer differently.
 */
const useCollaborationBaseUrl = () => {
  const { data: conf } = useConfig();

  return (
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? // TODO(yhub): no prod ingress route yet
        `wss://${window.location.host}/collaboration/ws/v1/docs`
      : '')
  );
};

export const useCollaborationUrl = (room?: string) => {
  const baseUrl = useCollaborationBaseUrl();

  if (!room) {
    return;
  }

  // The room is appended to the base URL by the provider (y-websocket)
  return baseUrl;
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

/**
 * The collaboration server's http address, for the routes that are plain REST
 * rather than a transport: the editing history (`activity`, `changeset`) and
 * the restore it feeds (`rollback`).
 *
 * `undefined` while the configuration is still loading, and for an instance
 * whose collaboration url is not shaped like a room url — the same answer, and
 * the same reason, as the http fallback's: no address is better than one nobody
 * serves.
 */
export const useCollaborationTarget = (): CollaborationTarget | undefined => {
  const baseUrl = useCollaborationBaseUrl();

  return baseUrl ? collaborationHttpTarget(baseUrl) : undefined;
};
