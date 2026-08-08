import { IncomingHttpHeaders } from 'http';

import axios from 'axios';

import { COLLABORATION_BACKEND_BASE_URL, Y_PROVIDER_API_KEY } from '@/env';

export interface User {
  id: string;
  email: string;
  full_name: string;
  short_name: string;
  language: string;
}

type Base64 = string;

interface Doc {
  id: string;
  title?: string;
  content?: Base64;
  creator: string;
  is_favorite: boolean;
  link_reach: 'restricted' | 'public' | 'authenticated';
  link_role: 'reader' | 'editor';
  nb_accesses_ancestors: number;
  nb_accesses_direct: number;
  created_at: string;
  updated_at: string;
  abilities: {
    accesses_manage: boolean;
    accesses_view: boolean;
    ai_proxy: boolean;
    ai_transform: boolean;
    ai_translate: boolean;
    attachment_upload: boolean;
    children_create: boolean;
    children_list: boolean;
    collaboration_auth: boolean;
    destroy: boolean;
    favorite: boolean;
    invite_owner: boolean;
    link_configuration: boolean;
    media_auth: boolean;
    move: boolean;
    partial_update: boolean;
    restore: boolean;
    retrieve: boolean;
    update: boolean;
    versions_destroy: boolean;
    versions_list: boolean;
    versions_retrieve: boolean;
  };
}

/**
 * In production the backend sets SECURE_SSL_REDIRECT and only trusts
 * X-Forwarded-Proto to tell whether TLS was terminated upstream. This call is
 * internal, so when COLLABORATION_BACKEND_BASE_URL points at the backend
 * directly it never crosses the reverse proxy: nothing sets the header, Django
 * answers a 301 to https://<host>:<port>, and the client then speaks TLS to a
 * port that serves plain HTTP.
 *
 * Always send https: it is the safe default given the current Production
 * settings. Relaying the client's own X-Forwarded-Proto would let a client
 * that sends X-Forwarded-Proto: http on its WebSocket upgrade force a 301 and
 * break its own connection — a vector this fix has no reason to introduce.
 */
async function fetch<T>(
  path: string,
  requestHeaders: IncomingHttpHeaders,
): Promise<T> {
  const response = await axios.get<T>(
    `${COLLABORATION_BACKEND_BASE_URL}${path}`,
    {
      headers: {
        cookie: requestHeaders['cookie'],
        origin: requestHeaders['origin'],
        'X-Y-Provider-Key': Y_PROVIDER_API_KEY,
        'X-Forwarded-Proto': 'https',
      },
    },
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return response.data;
}

export function fetchDocument(
  { name }: { name: string },
  requestHeaders: IncomingHttpHeaders,
): Promise<Doc> {
  return fetch<Doc>(`/api/v1.0/documents/${name}/`, requestHeaders);
}

export function fetchCurrentUser(
  requestHeaders: IncomingHttpHeaders,
): Promise<User> {
  return fetch<User>('/api/v1.0/users/me/', requestHeaders);
}
