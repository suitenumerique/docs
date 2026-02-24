import { Server } from 'node:net';

import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';
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

import * as CollaborationBackend from '@/api/collaborationBackend';
import { COLLABORATION_SERVER_ORIGIN as origin, PORT as port } from '@/env';
import { promiseDone } from '@/helpers';
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

  test('WebSocket connection not allowed if room is not a valid uuid v4', () => {
    const { promise, done } = promiseDone();
    const room = uuidv1();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      onAuthenticationFailed: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'Room name is not a valid uuid:',
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

  test('WebSocket connection not allowed if room is not a valid uuid', () => {
    const { promise, done } = promiseDone();
    const room = 'not-a-valid-uuid';
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      onAuthenticationFailed: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'Room name is not a valid uuid:',
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

  test('WebSocket connection fails if user can not access document', () => {
    const { promise, done } = promiseDone();

    const room = uuidv4();

    const fetchDocumentMock = vi
      .spyOn(CollaborationBackend, 'fetchDocument')
      .mockRejectedValue(new Error('some error'));

    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      onAuthenticationFailed: (data) => {
        expect(console.error).toHaveBeenLastCalledWith(
          '[onConnect]',
          'Backend error: Unauthorized',
        );

        wsHocus.stopConnectionAttempt();
        expect(data.reason).toBe('permission-denied');
        expect(fetchDocumentMock).toHaveBeenCalledExactlyOnceWith(
          { name: room, withoutContent: true },
          expect.any(Object),
        );
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

  test('WebSocket connection fails if user do not have correct retrieve ability', () => {
    const { promise, done } = promiseDone();

    const room = uuidv4();

    const fetchDocumentMock = vi
      .spyOn(CollaborationBackend, 'fetchDocument')
      .mockResolvedValue({ abilities: { retrieve: false } } as any);

    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
      maxAttempts: 1,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      onAuthenticationFailed: (data) => {
        expect(console.log).toHaveBeenLastCalledWith(
          expect.any(String),
          ' --- ',
          'onConnect: Unauthorized to retrieve this document',
          room,
        );

        wsHocus.stopConnectionAttempt();
        expect(data.reason).toBe('permission-denied');
        expect(fetchDocumentMock).toHaveBeenCalledExactlyOnceWith(
          { name: room, withoutContent: true },
          expect.any(Object),
        );
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

  [true, false].forEach((canEdit) => {
    test(`WebSocket connection ${canEdit ? 'can' : 'can not'} edit document`, () => {
      const { promise, done } = promiseDone();

      const fetchDocumentMock = vi
        .spyOn(CollaborationBackend, 'fetchDocument')
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
        onConnect: () => {
          void hocuspocusServer.hocuspocus
            .openDirectConnection(room)
            .then((connection) => {
              connection.document?.getConnections().forEach((connection) => {
                expect(connection.readOnly).toBe(!canEdit);
              });

              void connection.disconnect();

              provider.destroy();
              wsHocus.destroy();

              expect(fetchDocumentMock).toHaveBeenCalledWith(
                { name: room, withoutContent: true },
                expect.any(Object),
              );

              done();
            });
        },
      });

      provider.attach();

      return promise;
    });
  });

  test('Add request header x-user-id if found', () => {
    const { promise, done } = promiseDone();

    const fetchDocumentMock = vi
      .spyOn(CollaborationBackend, 'fetchDocument')
      .mockResolvedValue({
        abilities: { retrieve: true, update: true },
      } as any);

    const fetchCurrentUserMock = vi
      .spyOn(CollaborationBackend, 'fetchCurrentUser')
      .mockResolvedValue({ id: 'test-user-id' } as any);

    const room = uuidv4();
    const wsHocus = new HocuspocusProviderWebsocket({
      url: `ws://localhost:${portWS}/?room=${room}`,
      WebSocketPolyfill: WebSocket,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsHocus,
      name: room,
      onConnect: () => {
        const document = hocuspocusServer.hocuspocus.documents.get(room);
        if (document) {
          document.getConnections().forEach((connection) => {
            expect(connection.context.userId).toBe('test-user-id');
          });
        }

        provider.destroy();
        wsHocus.destroy();

        expect(fetchDocumentMock).toHaveBeenCalledWith(
          { name: room, withoutContent: true },
          expect.any(Object),
        );

        expect(fetchCurrentUserMock).toHaveBeenCalled();

        done();
      },
    });

    provider.attach();

    return promise;
  });
});
