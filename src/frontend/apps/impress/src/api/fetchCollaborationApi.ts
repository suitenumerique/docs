import { APIError } from './APIError';

/**
 * Where the collaboration server lives and which org its rooms are under, as
 * `collaborationHttpTarget` derives it from the websocket url.
 */
export interface CollaborationTarget {
  serverUrl: string;
  org: string;
}

export type CollaborationQuery = Record<
  string,
  string | number | boolean | undefined
>;

interface FetchCollaborationInit extends Omit<RequestInit, 'body'> {
  query?: CollaborationQuery;
  body?: unknown;
}

/**
 * The collaboration server's error bodies are `{ error, code, ... }`, which is
 * not the shape `errorCauses` reads (it flattens DRF's `{ field: [...] }` and
 * would hand back the letters of a string). `code` is the part worth keeping:
 * `doc-deleted` is the only way to tell a deleted document from one that was
 * never written, since a docid nobody has ever saved answers 200 with an empty
 * document.
 */
interface CollaborationErrorBody {
  error?: string;
  code?: string;
}

const collaborationError = async (response: Response, message: string) => {
  let body: CollaborationErrorBody = {};

  try {
    body = (await response.json()) as CollaborationErrorBody;
  } catch {
    // an error with no json body — a proxy's 502 page, an aborted response
  }

  return new APIError(message, {
    status: response.status,
    cause: [body.error ?? response.statusText],
    data: { code: body.code },
  });
};

/**
 * Call one of the collaboration server's REST endpoints for a document.
 *
 * Deliberately not `fetchAPI`: that one prefixes the Django api url and attaches
 * the CSRF token, neither of which applies here. What this shares with it is the
 * credential — the session cookie, exactly as on the websocket upgrade and on
 * the http fallback's polling (see `useProviderStore`).
 *
 * `Accept: application/json` is not optional. The collaboration server
 * negotiates on that header alone and otherwise answers `application/x-lib0any`,
 * which would need a decoder; in the json path it base64-encodes binary fields
 * such as `ydoc`.
 *
 * The url is `{serverUrl}/{endpoint}/v1/{org}/{docId}`, the same shape the http
 * fallback polls for `ydoc`.
 */
export const fetchCollaborationAPI = async <T>(
  target: CollaborationTarget,
  endpoint: string,
  docId: string,
  { query, body, headers, ...init }: FetchCollaborationInit = {},
): Promise<T> => {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });
  const search = params.toString();

  const response = await fetch(
    `${target.serverUrl}/${endpoint}/v1/${target.org}/${docId}${search ? `?${search}` : ''}`,
    {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    },
  );

  if (!response.ok) {
    throw await collaborationError(
      response,
      `Failed to reach the collaboration server (${endpoint})`,
    );
  }

  return response.json() as Promise<T>;
};
