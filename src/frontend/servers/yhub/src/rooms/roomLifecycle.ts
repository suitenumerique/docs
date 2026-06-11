import { randomUUID } from 'crypto';

import { YHub } from '@y/hub';

import { YHUB_REDIS_PREFIX } from '@/env';
import {
  ConnectionRegistry,
  GatewayConnection,
  RedisClient,
} from '@/registry/connectionRegistry';
import { YHUB_BRANCH, YHUB_ORG } from '@/routes';
import { logger } from '@/utils';

const LOCK_TTL_MS = 5_000;
const LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export const withRedisLock = async <T>(
  redis: RedisClient,
  key: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const token = randomUUID();
  const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;
  while (
    (await redis.set(key, token, { NX: true, PX: LOCK_TTL_MS })) === null
  ) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out acquiring lock ${key}`);
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
  try {
    return await fn();
  } finally {
    await redis
      .eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] })
      .catch((error) => logger('lock release error', key, error));
  }
};

/**
 * Drops everything @y/hub knows about a room: the persisted Postgres rows
 * (and any plugin-stored assets) plus the Redis stream backlog.
 */
export const purgeRoom = async (
  yhub: YHub,
  redis: RedisClient,
  room: string,
) => {
  const yroom = { org: YHUB_ORG, docid: room, branch: YHUB_BRANCH };
  // All columns must be included: retrieveDoc only reports references for
  // the columns it actually read, and deleteReferences deletes rows by their
  // referenced timestamps.
  const { references } = await yhub.persistence.retrieveDoc(yroom, {
    gc: true,
    nongc: true,
    contentmap: true,
    contentids: true,
    references: true,
  });
  if (references && references.length > 0) {
    await yhub.persistence.deleteReferences(references);
  }
  await redis.del(
    `${YHUB_REDIS_PREFIX}:room:${YHUB_ORG}:${room}:${YHUB_BRANCH}`,
  );
  logger('purged room', room, `(${references?.length ?? 0} persisted rows)`);
};

export interface RoomLifecycleDeps {
  yhub: YHub;
  redis: RedisClient;
  registry: ConnectionRegistry;
}

/**
 * Disposable-cache semantics (plan §3.5): when the first client (re)opens a
 * room, drop whatever @y/hub cached from the previous session — the client
 * arrives seeded with Django's content (the source of truth) and re-seeds the
 * room through the normal sync. The lock serializes concurrent first joiners:
 * whoever wins purges, the loser then sees a non-empty registry and skips.
 *
 * Residual races (both benign — same Y.Doc lineage merges cleanly):
 * - rejoin while a compaction task is still in flight may re-insert last
 *   session's rows after the purge;
 * - ghost registry keys after an instance crash make the room look occupied
 *   for up to CONN_TTL_SECONDS, skipping the purge.
 */
export const ensureFreshRoomAndRegister = async (
  { yhub, redis, registry }: RoomLifecycleDeps,
  conn: GatewayConnection,
) => {
  await withRedisLock(
    redis,
    `${YHUB_REDIS_PREFIX}:gw:purgelock:${conn.room}`,
    async () => {
      const entries = await registry.listRoom(conn.room);
      if (entries.length === 0) {
        await purgeRoom(yhub, redis, conn.room);
      }
      await registry.register(conn);
    },
  );
};
