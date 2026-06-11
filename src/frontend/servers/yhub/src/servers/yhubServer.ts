import { YHub, createYHub } from '@y/hub';

import {
  POSTGRES_URL,
  REDIS_URL,
  YHUB_INTERNAL_PORT,
  YHUB_MAX_DOC_SIZE,
  YHUB_MIN_MESSAGE_LIFETIME,
  YHUB_REDIS_PREFIX,
  YHUB_TASK_CONCURRENCY,
  YHUB_TASK_DEBOUNCE,
} from '@/env';
import { RedisClient } from '@/registry/connectionRegistry';
import { createGatewayAuthPlugin } from '@/yhubauth/authPlugin';

/**
 * Replicates @y/hub's bin/init-db.js: the worker claims compaction tasks from
 * a Redis consumer group that must exist before the worker polls it.
 */
export const ensureWorkerStream = async (redis: RedisClient) => {
  const name = `${YHUB_REDIS_PREFIX}:worker`;
  try {
    await redis.xGroupCreate(name, name, '0', { MKSTREAM: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) {
      throw error;
    }
  }
};

/** Replicates the yhub_ydoc_v1 table creation from @y/hub's bin/init-db.js. */
export const ensureSchema = async (yhub: YHub) => {
  await yhub.persistence.sql`
    CREATE TABLE IF NOT EXISTS yhub_ydoc_v1 (
        org             text,
        docid           text,
        branch          text,
        t               text,
        created         INT8,
        gcDoc           bytea,
        nongcDoc        bytea,
        contentmap      bytea,
        contentids      bytea,
        PRIMARY KEY     (org,docid,branch,t)
    );
  `;
};

/**
 * Boots the embedded @y/hub: the internal uws WebSocket server on
 * YHUB_INTERNAL_PORT (never published outside the container — only the
 * gateway dials it, with single-use tokens) and the compaction worker.
 */
export const createEmbeddedYHub = async (): Promise<YHub> => {
  const yhub = await createYHub({
    redis: {
      url: REDIS_URL,
      prefix: YHUB_REDIS_PREFIX,
      ...(YHUB_TASK_DEBOUNCE !== undefined && {
        taskDebounce: YHUB_TASK_DEBOUNCE,
      }),
      ...(YHUB_MIN_MESSAGE_LIFETIME !== undefined && {
        minMessageLifetime: YHUB_MIN_MESSAGE_LIFETIME,
      }),
    },
    postgres: POSTGRES_URL,
    persistence: [],
    server: {
      port: YHUB_INTERNAL_PORT,
      auth: createGatewayAuthPlugin(),
      // Note: @y/hub 0.2.22 overwrites maxDocSize with 500MB in the YHub
      // constructor; kept here for forward compatibility.
      ...(YHUB_MAX_DOC_SIZE !== undefined && { maxDocSize: YHUB_MAX_DOC_SIZE }),
    },
    worker: { taskConcurrency: YHUB_TASK_CONCURRENCY },
  });
  await ensureSchema(yhub);
  return yhub;
};
