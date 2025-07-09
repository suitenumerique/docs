import { User } from '@/features/auth';

export interface Access {
  id: string;
  max_ancestors_role: Role;
  role: Role;
  max_role: Role;
  team: string;
  user: User;
  document: {
    id: string;
    path: string;
    depth: number;
  };
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

export const RoleImportance = {
  [Role.READER]: 1,
  [Role.EDITOR]: 2,
  [Role.ADMIN]: 3,
  [Role.OWNER]: 4,
};

export enum LinkReach {
  RESTRICTED = 'restricted',
  AUTHENTICATED = 'authenticated',
  PUBLIC = 'public',
}

export enum LinkRole {
  READER = 'reader',
  EDITOR = 'editor',
}

export type Base64 = string;

export interface Doc {
  id: string;
  title?: string;
  children?: Doc[];
  childrenCount?: number;
  content: Base64;
  created_at: string;
  creator: string;
  depth: number;
  path: string;
  is_favorite: boolean;
  link_reach: LinkReach;
  link_role: LinkRole;
  nb_accesses_direct: number;
  nb_accesses_ancestors: number;
  computed_link_reach: LinkReach;
  computed_link_role?: LinkRole;
  ancestors_link_reach: LinkReach;
  ancestors_link_role?: LinkRole;
  numchild: number;
  updated_at: string;
  user_role: Role;
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
    duplicate: boolean;
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
    link_select_options: LinkSelectOption;
  };
}

export interface LinkSelectOption {
  public?: LinkRole[];
  authenticated?: LinkRole[];
  restricted?: LinkRole[];
}

export enum DocDefaultFilter {
  ALL_DOCS = 'all_docs',
  MY_DOCS = 'my_docs',
  SHARED_WITH_ME = 'shared_with_me',
}

export type DocsOrdering =
  | 'title'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at'
  | '-title'
  | undefined;

export interface AccessRequest {
  id: string;
  document: string;
  user: User;
  role: Role;
  created_at: string;
  abilities: {
    destroy: boolean;
    update: boolean;
    partial_update: boolean;
    retrieve: boolean;
    accept: boolean;
  };
}
