import { Server } from 'node:net';

import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import {
  afterAll,
  beforeAll,
  beforeEach,
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
  getCurrentUser: vi.fn(),
  getDocument: vi.fn(),
}));

console.error = vi.fn();
console.log = vi.fn();

import * as CollaborationBackend from '@/api/collaborationBackend';
import { COLLABORATION_SERVER_ORIGIN as origin, PORT as port } from '@/env';
import { promiseDone } from '@/helpers';
import { hocuspocusServer, initApp } from '@/servers';

describe('Server Tests', () => {
  let server: Server;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    server = initApp().listen(port);
    await hocuspocusServer.configure({ port: portWS }).listen();
  });

  afterAll(() => {
    void hocuspocusServer.destroy();
    server.close();
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

    const getDocumentMock = vi
      .spyOn(CollaborationBackend, 'getDocument')
      .mockRejectedValue(new Error('some error'));

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
        expect(getDocumentMock).toHaveBeenCalledExactlyOnceWith(
          room,
          expect.any(Object),
        );
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

    const getDocumentMock = vi
      .spyOn(CollaborationBackend, 'getDocument')
      .mockResolvedValue({ abilities: { retrieve: false } } as any);

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
        expect(getDocumentMock).toHaveBeenCalledExactlyOnceWith(
          room,
          expect.any(Object),
        );
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

      const getDocumentMock = vi
        .spyOn(CollaborationBackend, 'getDocument')
        .mockResolvedValue({
          abilities: { retrieve: true, update: canEdit },
        } as any);

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
          void hocuspocusServer
            .openDirectConnection(room)
            .then((connection) => {
              connection.document?.getConnections().forEach((connection) => {
                expect(connection.readOnly).toBe(!canEdit);
              });

              void connection.disconnect();

              provider.destroy();
              wsHocus.destroy();

              expect(getDocumentMock).toHaveBeenCalledWith(
                room,
                expect.any(Object),
              );

              done();
            });
        },
      });

      return promise;
    });
  });

  test('Add request header x-user-id if found', () => {
    const { promise, done } = promiseDone();

    const getDocumentMock = vi
      .spyOn(CollaborationBackend, 'getDocument')
      .mockResolvedValue({
        abilities: { retrieve: true, update: true },
      } as any);

    const getCurrentUserMock = vi
      .spyOn(CollaborationBackend, 'getCurrentUser')
      .mockResolvedValue({ id: 'test-user-id' } as any);

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
        void hocuspocusServer.openDirectConnection(room).then((connection) => {
          connection.document?.getConnections().forEach((connection) => {
            expect(connection.context.userId).toBe('test-user-id');
          });

          void connection.disconnect();
          provider.destroy();
          wsHocus.destroy();

          expect(getDocumentMock).toHaveBeenCalledWith(
            room,
            expect.any(Object),
          );

          expect(getCurrentUserMock).toHaveBeenCalled();

          done();
        });
      },
    });

    return promise;
  });
});
