import { Server, Socket } from 'node:net';

import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import { v4 as uuidv4 } from 'uuid';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import WebSocket from 'ws';

const portWS = 6666;

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    PORT: 5559,
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
    COLLABORATION_BACKEND_BASE_URL: 'http://app-dev:8000',
    COLLABORATION_LOGGING: 'true',
  };
});

vi.mock('../src/api/collaborationBackend', () => ({
  fetchCurrentUser: vi.fn(),
  fetchDocument: vi.fn(),
}));

console.error = vi.fn();
console.log = vi.fn();

import { COLLABORATION_SERVER_ORIGIN as origin, PORT as port } from '@/env';
import { promiseDone } from '@/helpers';
import { routes } from '@/routes';
import { hocuspocusServer, initApp } from '@/servers';

describe('Server Tests', () => {
  let server: Server;

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    server = initApp().listen(port);
    await hocuspocusServer.listen(portWS);
  });

  afterAll(() => {
    void hocuspocusServer.destroy();
    server.close();
  });

  test('WebSocket connection with bad origin should be closed', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const ws = new WebSocket(`ws://localhost:${port}/?room=${room}`, {
      headers: {
        Origin: 'http://bad-origin.com',
      },
    });

    ws.onclose = () => {
      expect(ws.readyState).toBe(ws.CLOSED);
      done();
    };

    return promise;
  });

  test('WebSocket connection without cookies header should be closed', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const ws = new WebSocket(`ws://localhost:${port}/?room=${room}`, {
      headers: {
        Origin: origin,
      },
    });

    ws.onclose = () => {
      expect(ws.readyState).toBe(ws.CLOSED);
      done();
    };

    return promise;
  });

  [
    {
      title: 'rejected for a bad origin',
      path: routes.COLLABORATION_WS,
      headers: { Origin: 'http://bad-origin.com' },
    },
    {
      title: 'rejected for missing cookies',
      path: routes.COLLABORATION_WS,
      headers: { Origin: origin },
    },
    {
      title: 'on an unknown route',
      path: '/unknown-route/',
      headers: { Origin: origin, Cookie: 'docs_sessionid=abc' },
    },
  ].forEach(({ title, path, headers }) => {
    test(`Malformed frame on a WebSocket ${title} does not crash the server`, () => {
      const { promise, done } = promiseDone();
      const ws = new WebSocket(
        `ws://localhost:${port}${path}?room=${uuidv4()}`,
        { headers },
      );

      ws.onopen = () => {
        // Masked text frame with the reserved RSV2 bit set: the server has
        // already started closing the socket but still reads this frame.
        (ws as unknown as { _socket: Socket })._socket.write(
          Buffer.from([0xa1, 0x80, 0x00, 0x00, 0x00, 0x00]),
        );
      };

      ws.onclose = () => {
        expect(console.error).toHaveBeenCalledWith(
          'WebSocket connection error:',
          expect.objectContaining({
            message: expect.stringContaining('RSV2 and RSV3 must be clear'),
          }),
        );
        done();
      };

      return promise;
    });
  });

  test('WebSocket connection not allowed if room not matching provider name', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
    });

    const providerName = uuidv4();
    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: providerName,
      onAuthenticationFailed(data) {
        expect(console.log).toHaveBeenCalledWith(
          expect.any(String),
          ' --- ',
          'Invalid room name - Probable hacking attempt:',
          providerName,
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.reason).toBe('permission-denied');
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    provider.attach();

    return promise;
  });
});
