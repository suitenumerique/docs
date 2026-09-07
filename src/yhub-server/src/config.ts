/**
 * Every environment variable this server reads, in one place: parsed, validated
 * and refused at import time when it cannot be trusted, so a misconfiguration is
 * a startup error naming the variable rather than a pod that looks healthy and
 * is not.
 *
 * `backend.ts`, `api.ts` and `server.ts` import their settings from here; the
 * `*_FILE` secret indirection is `env.ts`.
 */
import { secret } from './env.js';

// A numeric setting, read from the environment and refused rather than guessed
// when it is not a whole number at or above `min`: `Number()` reads a typo as
// NaN, which yhub takes as-is and turns into a worker that claims nothing or a
// stream that is never trimmed — a deployment that looks healthy and is not.
// An unset or empty variable is the default, so a kubernetes env var left blank
// behaves as if it had not been set at all.
const intEnv = (name: string, dflt: number, min = 1): number => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? dflt : Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min} (got "${raw}")`);
  }
  return value;
};

export const PORT = Number(process.env.PORT || 3002);
export const REDIS = process.env.REDIS;
export const POSTGRES = process.env.POSTGRES;
export const REDIS_PREFIX = process.env.REDIS_PREFIX || 'yhub';
// How long an update waits on the stream before a worker claims the compaction
// task it belongs to. It is the delay between an edit and its row in postgres,
// and the window over which the edits of a busy document are merged into one
// task: lowering it persists sooner and compacts more often, raising it does
// the reverse. yhub defaults to 120s, which is a long time to lose when a pod
// is killed — Docs asks for 10s.
export const TASK_DEBOUNCE_MS = intEnv('YHUB_TASK_DEBOUNCE_MS', 10000, 0);
// How long messages a worker has already persisted are kept on the stream. The
// trim stops at the older of that age and the point postgres holds, so this is
// not a durability setting — nothing unpersisted is ever trimmed. It is how
// much recent history stays replayable from redis instead of being read back
// out of postgres, paid for in memory on the redis side.
export const MIN_MESSAGE_LIFETIME_MS = intEnv(
  'YHUB_MIN_MESSAGE_LIFETIME_MS',
  60000,
  0,
);
export const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
export const allowedOrigins = (
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000'
).split(',');
export const Y_PROVIDER_API_KEY = secret('Y_PROVIDER_API_KEY', 'yprovider-api-key');
export const ORG = process.env.YHUB_ORG || 'docs';
// Which halves of yhub this process runs. The server accepts the websocket
// connections and serves the REST routes; the worker drains the redis stream
// into postgres. They share the two stores and nothing else — no in-process
// state, no ordering between them — so one process can run both (the default)
// or a deployment can split them and scale each on its own: the server with
// the connected editors, the worker with the write throughput.
//
// A stream is only drained by the workers that are running: a deployment of
// `server` alone keeps accepting edits and never persists them, so the two
// halves are split together or not at all.
export const ROLE = process.env.YHUB_ROLE || 'all';
if (!['all', 'server', 'worker'].includes(ROLE)) {
  throw new Error(
    `YHUB_ROLE must be one of "all", "server" or "worker" (got "${ROLE}")`,
  );
}
export const RUNS_SERVER = ROLE !== 'worker';
export const RUNS_WORKER = ROLE !== 'server';
// How many tasks one worker process claims at once. Redis hands each task to a
// single worker, so what a deployment actually runs in parallel is this times
// the number of worker processes — the two knobs are interchangeable up to the
// point where a pod runs out of memory, each task holding the document it
// merges.
export const TASK_CONCURRENCY = intEnv('YHUB_TASK_CONCURRENCY', 5, 1);
// Where the blobs of a compaction go — the garbage-collected document, the one
// that keeps its history, the content map and the content ids. yhub writes the
// four of them into its own postgres; a persistence plugin takes them out of
// it, the row then holding a reference and the bytes living in the plugin's
// store. Off by default, which is postgres alone, the way Docs has been
// running.
//
// This decides where *new* blobs are written, and nothing else. The plugin
// itself is loaded whenever the bucket below is configured, on or off, because
// a row pointing at an object is unreadable without the plugin that wrote it —
// yhub reports such a version as having no content rather than as an error, so
// a deployment that has ever had this on and drops the plugin loses those
// documents silently. Keep the YHUB_S3_* settings in place for as long as the
// bucket holds anything; turning this off then stops the writing and leaves the
// reading alone. See README.md.
export const S3_PERSISTENCE = process.env.YHUB_S3_PERSISTENCE === 'true';
// Its own bucket, named apart from the backend's `AWS_S3_*` and from the legacy
// document store's `LEGACY_S3_*` (migration.ts): three buckets that may sit on
// three providers with credentials of their own, each read by the process it
// belongs to.
export const YHUB_S3_ENDPOINT_URL = process.env.YHUB_S3_ENDPOINT_URL;
export const YHUB_S3_ACCESS_KEY_ID = secret('YHUB_S3_ACCESS_KEY_ID');
export const YHUB_S3_SECRET_ACCESS_KEY = secret('YHUB_S3_SECRET_ACCESS_KEY');
export const YHUB_S3_BUCKET_NAME = process.env.YHUB_S3_BUCKET_NAME;
export const YHUB_S3_REGION_NAME = process.env.YHUB_S3_REGION_NAME;
// Segment every route is mounted under (`server.apiPrefix` below), matching the
// URL scheme Docs already routes to the collaboration server. Hardcoded like
// the audiences: the backend builds its urls with the same prefix.
export const API_PREFIX = 'collaboration';
// The identity of a caller who is not signed in. It is a userid rather than the
// absence of one on purpose: yhub refuses the websocket upgrade of a caller that
// holds the write but has no identity (401 `unauthenticated`), because
// attributions carry the userid — so without this an anonymous visitor could not
// edit a public document at all. Every anonymous edit is therefore attributed to
// one shared author; yhub's own userids are opaque strings and Docs' are UUIDs,
// so this cannot collide with a real one.
export const ANONYMOUS_USERID = 'anonymous';
// What the readiness check gives a store before reporting it unreachable. Short
// on purpose: the point of the probe is to answer, and answering "not ready"
// early is more useful than holding the connection until kubelet times out.
export const READINESS_TIMEOUT_MS = 2000;
// Requiring this audience stops a valid admin JWT that Django issued for
// another service (today: the y-converter token in converter_services.py,
// which is handed to the converter process) from being replayed against yhub.
// Hardcoded, like y-provider's Y_CONVERTER_AUDIENCE: both ends of a two-party
// contract, so an env var would only add a way to misconfigure it into a 401.
export const YHUB_AUDIENCE = 'yhub';
// lowercase only (no /i): Django serializes UUIDs lowercase, while yhub rooms
// and S3 keys are case-sensitive strings — accepting case variants would let a
// client open a parallel room for the same document (and, with soft migration,
// miss its S3 object and fork the document's lineage)
export const UUID4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// an empty Yjs update (what `Y.encodeStateAsUpdate(new Y.Doc())` encodes to) —
// hardcoded so we don't import @y/y for two bytes
export const EMPTY_YDOC = new Uint8Array([0, 0]);
// yhub's "no effective content" convention: an empty update encodes to 2 bytes,
// and anything up to 3 is read as an empty document
export const EMPTY_UPDATE_MAX_BYTES = 3;
// uws buffers the whole body before the handler sees it, so this cap does not
// bound upload memory — it bounds what a single create hands to a compute
// worker and writes to the valkey stream as one message. Creates carry one
// freshly-converted snapshot (typically KBs); anything bigger belongs on the
// websocket path.
export const MAX_CREATE_BYTES = 10 * 1024 * 1024;

export const BACKEND_NOTIFY_TIMEOUT_MS = 5000;
// Audience of the tokens the backend accepts from us. It must match the one
// its CollaborationServerAuthentication requires, a token minted for anything
// else is refused there.
export const BACKEND_AUDIENCE = 'docs-backend';
export const BACKEND_TOKEN_LIFETIME_S = 60;
// Renew this long before expiry so a token never dies in flight.
export const BACKEND_TOKEN_MARGIN_MS = 10000;

// We sign the calls we make to the backend, the mirror of the admin JWT it
// signs to call us: no long-lived shared secret, only our private key here and
// its public half published on the JWKS endpoint.
export const YHUB_JWT_PRIVATE_KEY = secret('YHUB_JWT_PRIVATE_KEY', '');
