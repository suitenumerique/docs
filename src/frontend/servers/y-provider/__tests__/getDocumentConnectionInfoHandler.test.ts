import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    PORT: 5556,
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
  };
});

console.error = vi.fn();

import { COLLABORATION_SERVER_ORIGIN as origin } from '@/env';
import { hocuspocusServer, initApp } from '@/servers';

const apiEndpoint = '/collaboration/api/get-connections/';

describe('Server Tests', () => {
  test('POST /collaboration/api/get-connections?room=[ROOM_ID] with incorrect API key should return 403', async () => {
    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room`)
      .set('Origin', origin)
      .set('Authorization', 'wrong-api-key');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized: Invalid API Key');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] failed if room not indicated', async () => {
    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key')
      .send({ document_id: 'test-document' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Room name not provided');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] failed if session key not indicated', async () => {
    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key')
      .send({ document_id: 'test-document' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Session key not provided');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] return a 404 if room not found', async () => {
    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room&sessionKey=test-session-key`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Room not found');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] returns connection info, session key existing', async () => {
    const document = await hocuspocusServer.hocuspocus.createDocument(
      'test-room',
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false },
      {},
    );

    document.addConnection({
      webSocket: 1,
      context: { sessionKey: 'test-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 2,
      context: { sessionKey: 'other-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 3,
      context: { sessionKey: 'last-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 4,
      context: { sessionKey: 'session-read-only' },
      document: document,
      pongReceived: false,
      readOnly: true,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);

    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room&sessionKey=test-session-key`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      count: 3,
      exists: true,
    });
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] returns connection info, session key not existing', async () => {
    const document = await hocuspocusServer.hocuspocus.createDocument(
      'test-room',
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false },
      {},
    );

    document.addConnection({
      webSocket: 1,
      context: { sessionKey: 'test-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 2,
      context: { sessionKey: 'other-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 3,
      context: { sessionKey: 'last-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 4,
      context: { sessionKey: 'session-read-only' },
      document: document,
      pongReceived: false,
      readOnly: true,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);

    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room&sessionKey=non-existing-session-key`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      count: 3,
      exists: false,
    });
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] returns connection info, session key not existing, read only connection', async () => {
    const document = await hocuspocusServer.hocuspocus.createDocument(
      'test-room',
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false },
      {},
    );

    document.addConnection({
      webSocket: 1,
      context: { sessionKey: 'test-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 2,
      context: { sessionKey: 'other-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 3,
      context: { sessionKey: 'last-session-key' },
      document: document,
      pongReceived: false,
      readOnly: false,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);
    document.addConnection({
      webSocket: 4,
      context: { sessionKey: 'session-read-only' },
      document: document,
      pongReceived: false,
      readOnly: true,
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);

    const app = initApp();

    const response = await request(app)
      .get(`${apiEndpoint}?room=test-room&sessionKey=session-read-only`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      count: 3,
      exists: false,
    });
  });
});
