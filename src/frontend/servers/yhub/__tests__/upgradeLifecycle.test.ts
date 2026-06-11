import { Server } from 'http';
import { AddressInfo } from 'net';

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

import type { ConnectionRegistry as ConnectionRegistryType } from '@/registry/connectionRegistry';
import type { initServer as initServerType } from '@/servers/appServer';

import { FakeRedis } from './fakeRedis';

// Must be set before '@/env' is loaded (hence the dynamic imports below):
// nothing listens on this port, so every upstream dial fails.
process.env.YHUB_INTERNAL_PORT = '14799';

const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const ORIGIN = 'http://localhost:3000';

const fakeYHub = {
  persistence: {
    retrieveDoc: () => Promise.resolve({ references: [] }),
    deleteReferences: () => Promise.resolve(),
  },
};

const waitFor = async (
  condition: () => Promise<boolean> | boolean,
  what: string,
) => {
  const deadline = Date.now() + 5_000;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('upgrade lifecycle cleanup', () => {
  let server: Server;
  let base: string;
  let registry: ConnectionRegistryType;

  beforeAll(async () => {
    const { ConnectionRegistry } =
      await import('@/registry/connectionRegistry');
    const { initServer }: { initServer: typeof initServerType } =
      await import('@/servers/appServer');
    const redis = new FakeRedis();
    registry = new ConnectionRegistry(redis as never, 'instance-1');
    server = initServer({
      yhub: fakeYHub as never,
      redis: redis as never,
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

  const grantAccess = () =>
    vi.spyOn(axios, 'get').mockImplementation((url) =>
      Promise.resolve(
        String(url).includes('/users/me/')
          ? { status: 200, data: { id: 'user-1' } }
          : {
              status: 200,
              data: { id: ROOM, abilities: { retrieve: true, update: true } },
            },
      ),
    );

  test('rejects with 503 and releases the registration when the upstream dial fails', async () => {
    grantAccess();

    const outcome = await new Promise<string>((resolve) => {
      const ws = new WebSocket(`${base}/collaboration/ws/${ROOM}`, {
        headers: { origin: ORIGIN, cookie: 'docs_sessionid=s1' },
      });
      const timer = setTimeout(() => {
        ws.terminate();
        resolve('timeout');
      }, 5_000);
      ws.on('error', () => undefined);
      ws.on('unexpected-response', (_request, response) => {
        clearTimeout(timer);
        ws.terminate();
        resolve(`http-${response.statusCode}`);
      });
      ws.on('open', () => {
        clearTimeout(timer);
        ws.close();
        resolve('open');
      });
    });

    expect(outcome).toBe('http-503');
    // no ghost left behind: the failed dial must deregister the connection
    await waitFor(
      async () => (await registry.listRoom(ROOM)).length === 0,
      'deregistration after failed upstream dial',
    );
  });

  test('releases the registration when the client disappears during auth', async () => {
    let resolveAuth: () => void = () => undefined;
    vi.spyOn(axios, 'get').mockImplementation((url) => {
      if (String(url).includes('/users/me/')) {
        return Promise.resolve({ status: 200, data: { id: 'user-1' } });
      }
      return new Promise((resolve) => {
        resolveAuth = () =>
          resolve({
            status: 200,
            data: { id: ROOM, abilities: { retrieve: true, update: true } },
          });
      });
    });

    const ws = new WebSocket(`${base}/collaboration/ws/${ROOM}`, {
      headers: { origin: ORIGIN, cookie: 'docs_sessionid=s2' },
    });
    ws.on('error', () => undefined);

    // let the upgrade reach the (blocked) Django auth call, then vanish
    await new Promise((resolve) => setTimeout(resolve, 100));
    ws.terminate();
    await new Promise((resolve) => setTimeout(resolve, 50));
    resolveAuth();

    await waitFor(
      async () => (await registry.listRoom(ROOM)).length === 0,
      'no ghost registration after client vanished mid-auth',
    );
    expect(registry.localRoom(ROOM)).toHaveLength(0);
  });
});
