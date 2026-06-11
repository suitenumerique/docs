import { describe, expect, test } from 'vitest';

import { ConnectionRegistry, RedisClient } from '@/registry/connectionRegistry';

import { FakeRedis } from './fakeRedis';

const makeRegistry = () => {
  const redis = new FakeRedis();
  const registry = new ConnectionRegistry(
    redis as unknown as RedisClient,
    'instance-1',
  );
  return { redis, registry };
};

describe('ConnectionRegistry', () => {
  test('register/listRoom/deregister round-trip', async () => {
    const { registry } = makeRegistry();
    const conn = {
      id: 'c1',
      room: 'room-1',
      userId: 'u1',
      sessionKey: 's1',
      canEdit: true,
    };
    await registry.register(conn);

    const entries = await registry.listRoom('room-1');
    expect(entries).toEqual([
      {
        connId: 'c1',
        userId: 'u1',
        sessionKey: 's1',
        canEdit: true,
        instanceId: 'instance-1',
      },
    ]);
    expect(registry.localRoom('room-1')).toHaveLength(1);

    await registry.deregister(conn);
    expect(await registry.listRoom('room-1')).toEqual([]);
    expect(registry.localRoom('room-1')).toHaveLength(0);
  });

  test('listRoom only matches the requested room', async () => {
    const { registry } = makeRegistry();
    await registry.register({ id: 'c1', room: 'room-1', canEdit: true });
    await registry.register({ id: 'c2', room: 'room-2', canEdit: false });

    expect(await registry.listRoom('room-1')).toHaveLength(1);
    expect(await registry.listRoom('room-2')).toHaveLength(1);
    expect(await registry.listRoom('room-3')).toHaveLength(0);
  });

  test('entries from other instances are listed too', async () => {
    const { redis, registry } = makeRegistry();
    const other = new ConnectionRegistry(
      redis as unknown as RedisClient,
      'instance-2',
    );
    await registry.register({ id: 'c1', room: 'room-1', canEdit: true });
    await other.register({ id: 'c2', room: 'room-1', canEdit: false });

    const entries = await registry.listRoom('room-1');
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.instanceId))).toEqual(
      new Set(['instance-1', 'instance-2']),
    );
    // but local sockets stay per-instance
    expect(registry.localRoom('room-1')).toHaveLength(1);
  });

  test('unparsable redis entries are dropped', async () => {
    const { redis, registry } = makeRegistry();
    await registry.register({ id: 'c1', room: 'room-1', canEdit: true });
    await redis.set('yhub:gw:conn:room-1:bad', 'not-json');

    const entries = await registry.listRoom('room-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].connId).toBe('c1');
  });
});
