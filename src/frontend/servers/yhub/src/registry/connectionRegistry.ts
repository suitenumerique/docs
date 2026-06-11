import { createClient } from 'redis';
import { WebSocket } from 'ws';

import {
  CONN_HEARTBEAT_SECONDS,
  CONN_TTL_SECONDS,
  YHUB_REDIS_PREFIX,
} from '@/env';
import { logger } from '@/utils';

export type RedisClient = ReturnType<typeof createClient>;

export interface GatewayConnection {
  id: string;
  room: string;
  userId?: string;
  sessionKey?: string;
  canEdit: boolean;
  client?: WebSocket;
  upstream?: WebSocket;
  /** Set when a kick targets this connection before its socket is attached. */
  kicked?: boolean;
}

export interface RegistryEntry {
  connId: string;
  userId?: string;
  sessionKey?: string;
  canEdit: boolean;
  instanceId: string;
}

/**
 * Tracks gateway connections. The local Map holds the sockets (for kicks);
 * Redis holds one TTL'd key per connection so that counts are correct across
 * gateway instances and crashed instances self-clean within CONN_TTL_SECONDS.
 */
export class ConnectionRegistry {
  private local = new Map<string, Set<GatewayConnection>>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private redis: RedisClient,
    readonly instanceId: string,
  ) {}

  private key(room: string, connId: string) {
    return `${YHUB_REDIS_PREFIX}:gw:conn:${room}:${connId}`;
  }

  private entryValue(conn: GatewayConnection): string {
    return JSON.stringify({
      userId: conn.userId,
      sessionKey: conn.sessionKey,
      canEdit: conn.canEdit,
      instanceId: this.instanceId,
    });
  }

  async register(conn: GatewayConnection) {
    let conns = this.local.get(conn.room);
    if (!conns) {
      conns = new Set();
      this.local.set(conn.room, conns);
    }
    conns.add(conn);
    await this.redis.set(this.key(conn.room, conn.id), this.entryValue(conn), {
      EX: CONN_TTL_SECONDS,
    });
  }

  async deregister(conn: GatewayConnection) {
    const conns = this.local.get(conn.room);
    if (conns) {
      conns.delete(conn);
      if (conns.size === 0) {
        this.local.delete(conn.room);
      }
    }
    await this.redis.del(this.key(conn.room, conn.id));
  }

  localRoom(room: string): GatewayConnection[] {
    return [...(this.local.get(room) ?? [])];
  }

  localConnections(): GatewayConnection[] {
    return [...this.local.values()].flatMap((conns) => [...conns]);
  }

  async listRoom(room: string): Promise<RegistryEntry[]> {
    const keys: string[] = [];
    for await (const reply of this.redis.scanIterator({
      MATCH: `${YHUB_REDIS_PREFIX}:gw:conn:${room}:*`,
      COUNT: 100,
    })) {
      // node-redis v5 iterators yield batches, v4 yielded single keys
      keys.push(...(Array.isArray(reply) ? reply : [reply]));
    }
    if (keys.length === 0) {
      return [];
    }
    const values = await this.redis.mGet(keys);
    const entries: RegistryEntry[] = [];
    values.forEach((value, index) => {
      if (value === null) {
        return; // expired between SCAN and MGET
      }
      try {
        const parsed = JSON.parse(value) as Omit<RegistryEntry, 'connId'>;
        entries.push({
          ...parsed,
          connId: keys[index].split(':').pop() ?? '',
        });
      } catch {
        logger('registry: dropping unparsable entry', keys[index]);
      }
    });
    return entries;
  }

  startHeartbeat() {
    if (this.heartbeat) {
      return;
    }
    this.heartbeat = setInterval(() => {
      void (async () => {
        for (const conn of this.localConnections()) {
          await this.redis
            .set(this.key(conn.room, conn.id), this.entryValue(conn), {
              EX: CONN_TTL_SECONDS,
            })
            .catch((error) => logger('registry heartbeat error', error));
        }
      })();
    }, CONN_HEARTBEAT_SECONDS * 1000);
    this.heartbeat.unref();
  }

  stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
}
