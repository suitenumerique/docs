import { IncomingHttpHeaders } from 'http';

import axios from 'axios';

import { COLLABORATION_BACKEND_BASE_URL } from '@/env';

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
  content: Base64;
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
      },
    },
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return response.data;
}

export function fetchDocument(
  name: string,
  requestHeaders: IncomingHttpHeaders,
): Promise<Doc> {
  return fetch<Doc>(`/api/v1.0/documents/${name}/`, requestHeaders);
}

export function fetchCurrentUser(
  requestHeaders: IncomingHttpHeaders,
): Promise<User> {
  return fetch<User>('/api/v1.0/users/me/', requestHeaders);
}
