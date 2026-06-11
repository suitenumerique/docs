import { randomUUID } from 'crypto';
import { Server } from 'http';

import { YHub } from '@y/hub';
import { createClient } from 'redis';

import { REDIS_URL } from '@/env';
import { ConnectionRegistry, RedisClient } from '@/registry/connectionRegistry';
import { KICK_CLOSE_CODE, subscribeKicks } from '@/registry/kickChannel';
import { createEmbeddedYHub, ensureWorkerStream, initServer } from '@/servers';
import { logger } from '@/utils';

export interface Gateway {
  server: Server;
  yhub: YHub;
  registry: ConnectionRegistry;
  redis: RedisClient;
  shutdown: () => Promise<void>;
}

/** Boots the whole gateway: redis clients, embedded @y/hub, registry, kick
 * subscription and the HTTP server (not yet listening). */
export const bootGateway = async (): Promise<Gateway> => {
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  const subscriber = redis.duplicate();
  await subscriber.connect();

  // The worker consumer group must exist before @y/hub's worker polls it.
  await ensureWorkerStream(redis);

  const yhub = await createEmbeddedYHub();

  const registry = new ConnectionRegistry(redis, randomUUID());
  registry.startHeartbeat();

  await subscribeKicks(subscriber, ({ room, userId }) => {
    for (const conn of registry.localRoom(room)) {
      if (!userId || conn.userId === userId) {
        logger('kicking connection', room, conn.userId ?? 'anonymous');
        // The flag covers connections whose handshake is still in flight
        // (no socket to close yet): the upgrade handler closes them with
        // the kick code as soon as the socket attaches.
        conn.kicked = true;
        conn.client?.close(KICK_CLOSE_CODE, 'connection-reset');
      }
    }
  });

  const server = initServer({ yhub, redis, registry });

  const shutdown = async () => {
    server.close();
    for (const conn of registry.localConnections()) {
      conn.client?.close(1001, 'Server shutting down');
      await registry.deregister(conn).catch(() => undefined);
    }
    registry.stopHeartbeat();
    yhub.stopWorker();
    await yhub.computePool.destroy().catch(() => undefined);
    await yhub.server?.destroy().catch(() => undefined);
    await subscriber.quit().catch(() => undefined);
    await redis.quit().catch(() => undefined);
  };

  return { server, yhub, registry, redis, shutdown };
};
