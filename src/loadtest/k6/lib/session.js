/**
 * The users of a run: the manifest `create_load_test_sessions` writes
 * (src/backend/loadtest), one session per virtual user.
 *
 * k6 reads the file once, in the init context, and every VU keeps the session
 * of its rank: with more VUs than sessions a user is logged in several times,
 * and the API throttles per user (80/min on documents) — ask for at least as
 * many sessions as VUs.
 */
import { SharedArray } from 'k6/data';

const manifest = JSON.parse(open(__ENV.MANIFEST || '/manifest.json'));
if (!manifest.cookie_name || !manifest.sessions || manifest.sessions.length === 0) {
  throw new Error('The manifest holds no session');
}
if (manifest.expires_at && Date.parse(manifest.expires_at) < Date.now()) {
  throw new Error(`The sessions of the manifest expired at ${manifest.expires_at}`);
}

// shared between the VUs rather than copied into each of them
const sessions = new SharedArray('sessions', () => manifest.sessions);
const publicDocuments = new SharedArray('public documents', () => manifest.public_documents || []);

export const COOKIE_NAME = manifest.cookie_name;
export const sessionCount = () => sessions.length;

/** The session of this VU. */
export const mySession = () => sessions[(__VU - 1) % sessions.length];

/** A document of the VU's user, `editable` or any it may read; a public one when it has none. */
export const myDocument = (session, editable = false) => {
  const own = editable
    ? session.editable_documents
    : session.readonly_documents.concat(session.editable_documents);
  const pool = own.length > 0 ? own : publicDocuments;
  if (pool.length === 0) return null;
  return pool[__ITER % pool.length];
};

export const publicDocument = () =>
  publicDocuments.length > 0 ? publicDocuments[__ITER % publicDocuments.length] : null;
