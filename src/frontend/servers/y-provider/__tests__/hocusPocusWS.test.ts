import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

const port = 5559;
const portWS = 6666;
const origin = 'http://localhost:3000';

jest.mock('../src/env', () => {
  return {
    PORT: port,
    COLLABORATION_SERVER_ORIGIN: origin,
    COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
    COLLABORATION_BACKEND_BASE_URL: 'http://app-dev:8000',
    COLLABORATION_LOGGING: 'true',
  };
});

console.error = jest.fn();
console.log = jest.fn();

const mockDocFetch = jest.fn();
jest.mock('@/api/getDoc', () => ({
  fetchDocument: mockDocFetch,
}));

const mockGetMe = jest.fn();
jest.mock('@/api/getMe', () => ({
  getMe: mockGetMe,
}));

import { hocusPocusServer } from '@/servers/hocusPocusServer';

import { promiseDone } from '../src/helpers';
import { initServer } from '../src/servers/appServer';

const { server } = initServer();

describe('Server Tests', () => {
  beforeAll(async () => {
    await hocusPocusServer.configure({ port: portWS }).listen();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    server.close();
    void hocusPocusServer.destroy();
  });

  test('WebSocket connection with bad origin should be closed', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const ws = new WebSocket(
      `ws://localhost:${port}/collaboration/ws/?room=${room}`,
      {
        headers: {
          Origin: 'http://bad-origin.com',
        },
      },
    );

    ws.onclose = () => {
      expect(ws.readyState).toBe(ws.CLOSED);
      done();
    };

    return promise;
  });

  test('WebSocket connection without cookies header should be closed', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const ws = new WebSocket(
      `ws://localhost:${port}/collaboration/ws/?room=${room}`,
      {
        headers: {
          Origin: origin,
        },
      },
    );

    ws.onclose = () => {
      expect(ws.readyState).toBe(ws.CLOSED);
      done();
    };

    return promise;
  });

  test('WebSocket connection not allowed if room not matching provider name', () => {
    const { promise, done } = promiseDone();
    const room = uuidv4();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
      quiet: true,
    });

    const providerName = uuidv4();
    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: providerName,
      broadcast: false,
      quiet: true,
      preserveConnection: false,
      onClose: (data) => {
        expect(console.log).toHaveBeenCalledWith(
          expect.any(String),
          ' --- ',
          'Invalid room name - Probable hacking attempt:',
          providerName,
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.event.reason).toBe('Forbidden');
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    return promise;
  });

  test('WebSocket connection not allowed if room is not a valid uuid v4', () => {
    const { promise, done } = promiseDone();
    const room = uuidv1();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
      quiet: true,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      broadcast: false,
      quiet: true,
      preserveConnection: false,
      onClose: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'Room name is not a valid uuid:',
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.event.reason).toBe('Forbidden');
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    return promise;
  });

  test('WebSocket connection not allowed if room is not a valid uuid', () => {
    const { promise, done } = promiseDone();
    const room = 'not-a-valid-uuid';
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
      quiet: true,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      broadcast: false,
      quiet: true,
      preserveConnection: false,
      onClose: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'Room name is not a valid uuid:',
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.event.reason).toBe('Forbidden');
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    return promise;
  });

  test('WebSocket connection fails if user can not access document', () => {
    const { promise, done } = promiseDone();

    mockDocFetch.mockRejectedValue('');

    const room = uuidv4();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
      quiet: true,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      broadcast: false,
      quiet: true,
      preserveConnection: false,
      onClose: (data) => {
        expect(console.error).toHaveBeenLastCalledWith(
          '[onConnect]',
          'Backend error: Unauthorized',
        );

        wsHocus.stopConnectionAttempt();
        expect(data.event.reason).toBe('Forbidden');
        expect(mockDocFetch).toHaveBeenCalledTimes(1);
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    return promise;
  });

  test('WebSocket connection fails if user do not have correct retrieve ability', () => {
    const { promise, done } = promiseDone();

    const room = uuidv4();
    mockDocFetch.mockResolvedValue({
      abilities: {
        retrieve: false,
      },
    });

    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
      quiet: true,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      broadcast: false,
      quiet: true,
      preserveConnection: false,
      onClose: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'onConnect: Unauthorized to retrieve this document',
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.event.reason).toBe('Forbidden');
        expect(mockDocFetch).toHaveBeenCalledTimes(1);
        wsHocus.webSocket?.close();
        wsHocus.disconnect();
        provider.destroy();
        wsHocus.destroy();
        done();
      },
    });

    return promise;
  });

  [true, false].forEach((canEdit) => {
    test(`WebSocket connection ${canEdit ? 'can' : 'can not'} edit document`, () => {
      const { promise, done } = promiseDone();

      mockDocFetch.mockResolvedValue({
        abilities: {
          retrieve: true,
          update: canEdit,
        },
      });

      const room = uuidv4();
      const wsHocus = new HocuspocusProviderWebsocket({
        url: `ws://localhost:${portWS}/?room=${room}`,
        WebSocketPolyfill: WebSocket,
      });

      const provider = new HocuspocusProvider({
        websocketProvider: wsHocus,
        name: room,
        broadcast: false,
        quiet: true,
        onConnect: () => {
          void hocusPocusServer
            .openDirectConnection(room)
            .then((connection) => {
              connection.document?.getConnections().forEach((connection) => {
                expect(connection.readOnly).toBe(!canEdit);
              });

              void connection.disconnect();

              provider.destroy();
              wsHocus.destroy();
              done();
            });
        },
      });

      return promise;
    });
  });

  test('Add request header x-user-id if found', () => {
    const { promise, done } = promiseDone();

    mockDocFetch.mockResolvedValue({
      abilities: {
        retrieve: true,
        update: true,
      },
    });

    mockGetMe.mockResolvedValue({
      id: 'test-user-id',
    });

    const room = uuidv4();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      broadcast: false,
      quiet: true,
      onConnect: () => {
        void hocusPocusServer.openDirectConnection(room).then((connection) => {
          connection.document?.getConnections().forEach((connection) => {
            expect(connection.context.userId).toBe('test-user-id');
          });

          void connection.disconnect();
          provider.destroy();
          wsHocus.destroy();
          done();
        });
      },
    });

    return promise;
  });
});
