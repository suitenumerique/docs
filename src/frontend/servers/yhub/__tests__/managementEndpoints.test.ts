import { Server } from 'http';

import { YHub } from '@y/hub';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ConnectionRegistry, RedisClient } from '@/registry/connectionRegistry';
import { initServer } from '@/servers/appServer';

import { FakeRedis } from './fakeRedis';

// Default secrets from src/env.ts
const SECRET = 'secret-api-key';

describe('management endpoints', () => {
  let server: Server;
  let redis: FakeRedis;
  let registry: ConnectionRegistry;

  beforeAll(() => {
    redis = new FakeRedis();
    registry = new ConnectionRegistry(
      redis as unknown as RedisClient,
      'instance-1',
    );
    server = initServer({
      yhub: {} as unknown as YHub, // not touched by these routes
      redis: redis as unknown as RedisClient,
      registry,
    });
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /ping', () => {
    test('returns pong', async () => {
      const response = await request(server).get('/ping');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'pong' });
    });
  });

  describe('unknown routes', () => {
    test('return 403', async () => {
      const response = await request(server).get('/whatever');
      expect(response.status).toBe(403);
    });
  });

  describe('POST /collaboration/api/reset-connections/', () => {
    test('requires authentication', async () => {
      const response = await request(server).post(
        '/collaboration/api/reset-connections/?room=room-1',
      );
      expect(response.status).toBe(401);
    });

    test('rejects an invalid api key', async () => {
      const response = await request(server)
        .post('/collaboration/api/reset-connections/?room=room-1')
        .set('Authorization', 'wrong-key');
      expect(response.status).toBe(401);
    });

    test('requires the room parameter', async () => {
      const response = await request(server)
        .post('/collaboration/api/reset-connections/')
        .set('Authorization', SECRET);
      expect(response.status).toBe(400);
    });

    test('publishes a room-wide kick (raw secret, as Django sends it)', async () => {
      const response = await request(server)
        .post('/collaboration/api/reset-connections/?room=room-1')
        .set('Authorization', SECRET);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Connections reset' });
      expect(redis.published).toContainEqual({
        channel: 'yhub:gw:kick',
        message: JSON.stringify({ room: 'room-1' }),
      });
    });

    test('publishes a user-scoped kick with x-user-id (Bearer accepted too)', async () => {
      const response = await request(server)
        .post('/collaboration/api/reset-connections/?room=room-1')
        .set('Authorization', `Bearer ${SECRET}`)
        .set('X-User-Id', 'user-9');
      expect(response.status).toBe(200);
      expect(redis.published).toContainEqual({
        channel: 'yhub:gw:kick',
        message: JSON.stringify({ room: 'room-1', userId: 'user-9' }),
      });
    });
  });

  describe('GET /collaboration/api/get-connections/', () => {
    test('requires authentication', async () => {
      const response = await request(server).get(
        '/collaboration/api/get-connections/?room=room-1&sessionKey=s1',
      );
      expect(response.status).toBe(401);
    });

    test('requires room and sessionKey', async () => {
      const noRoom = await request(server)
        .get('/collaboration/api/get-connections/?sessionKey=s1')
        .set('Authorization', SECRET);
      expect(noRoom.status).toBe(400);

      const noKey = await request(server)
        .get('/collaboration/api/get-connections/?room=room-1')
        .set('Authorization', SECRET);
      expect(noKey.status).toBe(400);
    });

    test('returns 404 for an empty room (Django maps it to 0/False)', async () => {
      const response = await request(server)
        .get('/collaboration/api/get-connections/?room=empty&sessionKey=s1')
        .set('Authorization', SECRET);
      expect(response.status).toBe(404);
    });

    test('counts only writable connections and matches sessionKey', async () => {
      await registry.register({
        id: 'c1',
        room: 'room-2',
        sessionKey: 's-writer',
        canEdit: true,
      });
      await registry.register({
        id: 'c2',
        room: 'room-2',
        sessionKey: 's-reader',
        canEdit: false,
      });

      const asWriter = await request(server)
        .get(
          '/collaboration/api/get-connections/?room=room-2&sessionKey=s-writer',
        )
        .set('Authorization', SECRET);
      expect(asWriter.status).toBe(200);
      expect(asWriter.body).toEqual({ count: 1, exists: true });

      const asStranger = await request(server)
        .get('/collaboration/api/get-connections/?room=room-2&sessionKey=s-x')
        .set('Authorization', SECRET);
      expect(asStranger.body).toEqual({ count: 1, exists: false });
    });
  });
});
