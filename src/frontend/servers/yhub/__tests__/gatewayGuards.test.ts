import { Server } from 'http';
import { AddressInfo } from 'net';

import { YHub } from '@y/hub';
import axios from 'axios';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { WebSocket } from 'ws';

import { ConnectionRegistry, RedisClient } from '@/registry/connectionRegistry';
import { initServer } from '@/servers/appServer';

import { FakeRedis } from './fakeRedis';

const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const ORIGIN = 'http://localhost:3000'; // default COLLABORATION_SERVER_ORIGIN

type Outcome =
  | { outcome: 'http'; status: number }
  | { outcome: 'open' }
  | { outcome: 'error'; message: string }
  | { outcome: 'timeout' };

const tryUpgrade = (
  url: string,
  headers: Record<string, string>,
): Promise<Outcome> =>
  new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    const timer = setTimeout(() => {
      ws.terminate();
      resolve({ outcome: 'timeout' });
    }, 3000);
    ws.on('unexpected-response', (_request, response) => {
      clearTimeout(timer);
      ws.terminate();
      resolve({ outcome: 'http', status: response.statusCode ?? 0 });
    });
    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve({ outcome: 'open' });
    });
    ws.on('error', (error) => {
      clearTimeout(timer);
      resolve({ outcome: 'error', message: error.message });
    });
  });

describe('gateway upgrade guards', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const redis = new FakeRedis();
    const registry = new ConnectionRegistry(
      redis as unknown as RedisClient,
      'instance-1',
    );
    server = initServer({
      yhub: {} as unknown as YHub, // guards reject before yhub is touched
      redis: redis as unknown as RedisClient,
      registry,
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('unknown path → 404', async () => {
    await expect(tryUpgrade(`${base}/other/path`, {})).resolves.toEqual({
      outcome: 'http',
      status: 404,
    });
  });

  test('invalid room → 400', async () => {
    await expect(
      tryUpgrade(`${base}/collaboration/ws/not-a-uuid`, { origin: ORIGIN }),
    ).resolves.toEqual({ outcome: 'http', status: 400 });
  });

  test('missing room → 400', async () => {
    await expect(
      tryUpgrade(`${base}/collaboration/ws/`, { origin: ORIGIN }),
    ).resolves.toEqual({ outcome: 'http', status: 400 });
  });

  test('bad origin → 403', async () => {
    await expect(
      tryUpgrade(`${base}/collaboration/ws/${ROOM}`, {
        origin: 'http://evil.example',
      }),
    ).resolves.toEqual({ outcome: 'http', status: 403 });
  });

  test('no cookies → 401', async () => {
    await expect(
      tryUpgrade(`${base}/collaboration/ws/${ROOM}`, { origin: ORIGIN }),
    ).resolves.toEqual({ outcome: 'http', status: 401 });
  });

  test('backend error → 403', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('backend down'));
    await expect(
      tryUpgrade(`${base}/collaboration/ws/${ROOM}`, {
        origin: ORIGIN,
        cookie: 'docs_sessionid=abc',
      }),
    ).resolves.toEqual({ outcome: 'http', status: 403 });
  });

  test('missing retrieve ability → 403', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: { id: ROOM, abilities: { retrieve: false, update: false } },
    });
    await expect(
      tryUpgrade(`${base}/collaboration/ws/${ROOM}`, {
        origin: ORIGIN,
        cookie: 'docs_sessionid=abc',
      }),
    ).resolves.toEqual({ outcome: 'http', status: 403 });
  });
});
