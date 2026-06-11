import { YHub } from '@y/hub';
import { describe, expect, test, vi } from 'vitest';

import { ConnectionRegistry, RedisClient } from '@/registry/connectionRegistry';
import {
  ensureFreshRoomAndRegister,
  purgeRoom,
  withRedisLock,
} from '@/rooms/roomLifecycle';

import { FakeRedis } from './fakeRedis';

const fakeYHub = (references: unknown[] = [{ assetId: {}, asset: {} }]) => {
  const retrieveDoc = vi.fn().mockResolvedValue({ references });
  const deleteReferences = vi.fn().mockResolvedValue(undefined);
  return {
    yhub: { persistence: { retrieveDoc, deleteReferences } } as unknown as YHub,
    retrieveDoc,
    deleteReferences,
  };
};

describe('withRedisLock', () => {
  test('serializes concurrent critical sections', async () => {
    const redis = new FakeRedis() as unknown as RedisClient;
    const order: string[] = [];
    await Promise.all([
      withRedisLock(redis, 'lock:a', async () => {
        order.push('a-start');
        await new Promise((resolve) => setTimeout(resolve, 100));
        order.push('a-end');
      }),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await withRedisLock(redis, 'lock:a', () => {
          order.push('b');
          return Promise.resolve();
        });
      })(),
    ]);
    expect(order).toEqual(['a-start', 'a-end', 'b']);
  });

  test('releases the lock on error', async () => {
    const redis = new FakeRedis() as unknown as RedisClient;
    await expect(
      withRedisLock(redis, 'lock:b', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    // lock is free again
    await withRedisLock(redis, 'lock:b', () => Promise.resolve());
  });
});

describe('purgeRoom', () => {
  test('deletes persisted rows and the redis stream', async () => {
    const redis = new FakeRedis();
    await redis.set('yhub:room:docs:room-1:main', 'stream-placeholder');
    const { yhub, retrieveDoc, deleteReferences } = fakeYHub();

    await purgeRoom(yhub, redis as unknown as RedisClient, 'room-1');

    expect(retrieveDoc).toHaveBeenCalledWith(
      { org: 'docs', docid: 'room-1', branch: 'main' },
      {
        gc: true,
        nongc: true,
        contentmap: true,
        contentids: true,
        references: true,
      },
    );
    expect(deleteReferences).toHaveBeenCalled();
    expect(await redis.get('yhub:room:docs:room-1:main')).toBeNull();
  });

  test('skips deleteReferences when nothing is persisted', async () => {
    const redis = new FakeRedis();
    const { yhub, deleteReferences } = fakeYHub([]);
    await purgeRoom(yhub, redis as unknown as RedisClient, 'room-1');
    expect(deleteReferences).not.toHaveBeenCalled();
  });
});

describe('ensureFreshRoomAndRegister', () => {
  const setup = () => {
    const redis = new FakeRedis();
    const registry = new ConnectionRegistry(
      redis as unknown as RedisClient,
      'instance-1',
    );
    return { redis, registry };
  };

  test('purges on the 0→1 transition then registers', async () => {
    const { redis, registry } = setup();
    const { yhub, deleteReferences } = fakeYHub();
    const conn = { id: 'c1', room: 'room-1', canEdit: true };

    await ensureFreshRoomAndRegister(
      { yhub, redis: redis as unknown as RedisClient, registry },
      conn,
    );

    expect(deleteReferences).toHaveBeenCalledTimes(1);
    expect(await registry.listRoom('room-1')).toHaveLength(1);
  });

  test('does not purge when the room is already occupied', async () => {
    const { redis, registry } = setup();
    const { yhub, deleteReferences } = fakeYHub();
    const deps = { yhub, redis: redis as unknown as RedisClient, registry };

    await ensureFreshRoomAndRegister(deps, {
      id: 'c1',
      room: 'room-1',
      canEdit: true,
    });
    await ensureFreshRoomAndRegister(deps, {
      id: 'c2',
      room: 'room-1',
      canEdit: true,
    });

    expect(deleteReferences).toHaveBeenCalledTimes(1); // only the first join
    expect(await registry.listRoom('room-1')).toHaveLength(2);
  });

  test('concurrent first joiners purge exactly once', async () => {
    const { redis, registry } = setup();
    const { yhub, deleteReferences } = fakeYHub();
    const deps = { yhub, redis: redis as unknown as RedisClient, registry };

    await Promise.all([
      ensureFreshRoomAndRegister(deps, {
        id: 'c1',
        room: 'room-1',
        canEdit: true,
      }),
      ensureFreshRoomAndRegister(deps, {
        id: 'c2',
        room: 'room-1',
        canEdit: true,
      }),
    ]);

    expect(deleteReferences).toHaveBeenCalledTimes(1);
    expect(await registry.listRoom('room-1')).toHaveLength(2);
  });
});
