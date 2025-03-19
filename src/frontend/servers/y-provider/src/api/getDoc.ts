import { IncomingHttpHeaders } from 'http';

import axios from 'axios';

import { COLLABORATION_BACKEND_BASE_URL } from '@/env';

enum LinkReach {
  RESTRICTED = 'restricted',
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
}

enum LinkRole {
  READER = 'reader',
  EDITOR = 'editor',
}

type Base64 = string;

interface Doc {
  id: string;
  title?: string;
  content: Base64;
  creator: string;
  is_favorite: boolean;
  link_reach: LinkReach;
  link_role: LinkRole;
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

export const fetchDocument = async (
  documentName: string,
  requestHeaders: IncomingHttpHeaders,
) => {
  const response = await axios.get<Doc>(
    `${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/documents/${documentName}/`,
    {
      headers: {
        Cookie: requestHeaders['cookie'],
        Origin: requestHeaders['origin'],
      },
    },
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  return response.data;
};
