/**
 * The manifest `create_load_test_sessions` writes (src/backend/loadtest): which
 * cookie to send, and which documents each of the logged-in users may open.
 */
import { readFileSync } from 'node:fs';

export interface Session {
  user_id: string;
  session_key: string;
  editable_documents: string[];
  readonly_documents: string[];
}

export interface Manifest {
  cookie_name: string;
  expires_at?: string;
  public_documents: string[];
  sessions: Session[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const parseManifest = (text: string): Manifest => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `The manifest is not JSON: ${err instanceof Error ? err.message : err}`,
      { cause: err },
    );
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('The manifest is not an object');
  }
  const manifest = data as Record<string, unknown>;
  if (typeof manifest.cookie_name !== 'string' || !manifest.cookie_name) {
    throw new Error('The manifest has no cookie_name');
  }
  if (!Array.isArray(manifest.sessions) || manifest.sessions.length === 0) {
    throw new Error('The manifest holds no session');
  }
  const sessions = manifest.sessions.map((session, index): Session => {
    const s = session as Record<string, unknown>;
    if (typeof s.session_key !== 'string' || !s.session_key) {
      throw new Error(`Session #${index} has no session_key`);
    }
    return {
      user_id: typeof s.user_id === 'string' ? s.user_id : String(index),
      session_key: s.session_key,
      editable_documents: isStringArray(s.editable_documents)
        ? s.editable_documents
        : [],
      readonly_documents: isStringArray(s.readonly_documents)
        ? s.readonly_documents
        : [],
    };
  });
  if (manifest.expires_at !== undefined) {
    const expires = Date.parse(String(manifest.expires_at));
    if (!Number.isNaN(expires) && expires < Date.now()) {
      throw new Error(
        `The sessions of the manifest expired at ${manifest.expires_at}`,
      );
    }
  }
  return {
    cookie_name: manifest.cookie_name,
    expires_at:
      typeof manifest.expires_at === 'string' ? manifest.expires_at : undefined,
    public_documents: isStringArray(manifest.public_documents)
      ? manifest.public_documents
      : [],
    sessions,
  };
};

export const readManifest = (path: string): Manifest =>
  parseManifest(readFileSync(path, 'utf8'));
