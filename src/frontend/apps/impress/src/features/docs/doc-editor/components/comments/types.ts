import { CommentData, ThreadData } from '@blocknote/core/comments';

import { UserLight } from '@/features/auth';

export interface CommentAbilities {
  destroy: boolean;
  update: boolean;
  partial_update: boolean;
  retrieve: boolean;
  reactions: boolean;
}
export interface ThreadAbilities {
  destroy: boolean;
  update: boolean;
  partial_update: boolean;
  retrieve: boolean;
  resolve: boolean;
}

export interface ServerReaction {
  emoji: string;
  created_at: string;
  users: UserLight[] | null;
}

export interface ServerComment {
  id: string;
  user: UserLight | null;
  body: unknown;
  created_at: string;
  updated_at: string;
  reactions: ServerReaction[];
  abilities: CommentAbilities;
}

export interface ServerThread {
  id: string;
  created_at: string;
  updated_at: string;
  user: UserLight | null;
  resolved: boolean;
  resolved_updated_at: string | null;
  resolved_by: string | null;
  metadata: unknown;
  comments: ServerComment[];
  abilities: ThreadAbilities;
}

export type ClientCommentData = Omit<CommentData, 'metadata'> & {
  metadata: { abilities: CommentAbilities };
};

export type ClientThreadData = Omit<ThreadData, 'metadata'> & {
  metadata: { abilities: ThreadAbilities; metadata: unknown };
};
