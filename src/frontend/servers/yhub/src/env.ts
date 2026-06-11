import { readFileSync } from 'fs';

export const COLLABORATION_LOGGING =
  process.env.COLLABORATION_LOGGING || 'false';
export const COLLABORATION_SERVER_ORIGIN =
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000';
export const COLLABORATION_SERVER_SECRET = process.env
  .COLLABORATION_SERVER_SECRET_FILE
  ? readFileSync(process.env.COLLABORATION_SERVER_SECRET_FILE, 'utf-8')
  : process.env.COLLABORATION_SERVER_SECRET || 'secret-api-key';
export const Y_PROVIDER_API_KEY = process.env.Y_PROVIDER_API_KEY_FILE
  ? readFileSync(process.env.Y_PROVIDER_API_KEY_FILE, 'utf-8')
  : process.env.Y_PROVIDER_API_KEY || 'yprovider-api-key';
export const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
export const PORT = Number(process.env.PORT || 4444);
export const SENTRY_DSN = process.env.SENTRY_DSN || '';

/**
 * @y/hub backing services. In development both point at the shared compose
 * services; in production a dedicated Redis/Postgres is recommended (the
 * yhub state is a disposable cache, but its churn should not share the
 * Django database).
 */
export const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
export const POSTGRES_URL =
  process.env.POSTGRES_URL || 'postgres://dinum:pass@postgresql:5432/impress';
export const YHUB_REDIS_PREFIX = process.env.YHUB_REDIS_PREFIX || 'yhub';
/** Internal @y/hub uws server. Must never be published outside the container. */
export const YHUB_INTERNAL_PORT = Number(
  process.env.YHUB_INTERNAL_PORT || 4445,
);
export const YHUB_TASK_DEBOUNCE = process.env.YHUB_TASK_DEBOUNCE
  ? Number(process.env.YHUB_TASK_DEBOUNCE)
  : undefined;
export const YHUB_MIN_MESSAGE_LIFETIME = process.env.YHUB_MIN_MESSAGE_LIFETIME
  ? Number(process.env.YHUB_MIN_MESSAGE_LIFETIME)
  : undefined;
export const YHUB_TASK_CONCURRENCY = Number(
  process.env.YHUB_TASK_CONCURRENCY || 3,
);
export const YHUB_MAX_DOC_SIZE = process.env.YHUB_MAX_DOC_SIZE
  ? Number(process.env.YHUB_MAX_DOC_SIZE)
  : undefined;

/** Connection registry liveness (crash entries expire after CONN_TTL_SECONDS). */
export const CONN_TTL_SECONDS = Number(process.env.CONN_TTL_SECONDS || 30);
export const CONN_HEARTBEAT_SECONDS = Number(
  process.env.CONN_HEARTBEAT_SECONDS || 10,
);
/** One-time internal tokens handed from the gateway to the embedded yhub. */
export const AUTH_TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 10000);
