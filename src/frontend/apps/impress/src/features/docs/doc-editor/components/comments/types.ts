import { UserLight } from '@/features/auth';

export interface CommentThreadAbilities {
  destroy: boolean;
  update: boolean;
  partial_update: boolean;
  retrieve: boolean;
}

export interface ServerReaction {
  emoji: string;
  created_at: string;
  users: UserLight[];
}

export interface ServerComment {
  id: string;
  user: UserLight;
  body: unknown;
  created_at: string;
  updated_at: string;
  reactions: ServerReaction[];
  abilities: CommentThreadAbilities;
}

export interface ServerThread {
  id: string;
  created_at: string;
  updated_at: string;
  user: UserLight;
  resolved: boolean;
  resolved_updated_at: string | null;
  resolved_by: string | null;
  metadata: unknown;
  comments: ServerComment[];
  abilities: CommentThreadAbilities;
}
