import { User } from '@/core';

export interface Access {
  id: string;
  role: Role;
  team: string;
  user: User;
  abilities: {
    destroy: boolean;
    partial_update: boolean;
    retrieve: boolean;
    set_role_to: Role[];
    update: boolean;
  };
}

export enum Role {
  READER = 'reader',
  EDITOR = 'editor',
  ADMIN = 'administrator',
  OWNER = 'owner',
}

export enum LinkReach {
  RESTRICTED = 'restricted',
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
}

export enum LinkRole {
  READER = 'reader',
  EDITOR = 'editor',
}

export type Base64 = string;

export interface Doc {
  id: string;
  title: string;
  content: Base64;
  creator: string;
  is_favorite: boolean;
  link_reach: LinkReach;
  link_role: LinkRole;
  nb_accesses: number;
  created_at: string;
  updated_at: string;
  abilities: {
    accesses_manage: boolean;
    accesses_view: boolean;
    attachment_upload: true;
    destroy: boolean;
    link_configuration: boolean;
    partial_update: boolean;
    retrieve: boolean;
    update: boolean;
    versions_destroy: boolean;
    versions_list: boolean;
    versions_retrieve: boolean;
  };
}

export enum DocDefaultFilter {
  ALL_DOCS = 'all_docs',
  MY_DOCS = 'my_docs',
  SHARED_WITH_ME = 'shared_with_me',
}
