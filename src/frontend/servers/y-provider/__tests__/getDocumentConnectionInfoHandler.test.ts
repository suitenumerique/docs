import request from 'supertest';
import { v4 as uuid } from 'uuid';

const port = 5555;
const origin = 'http://localhost:3000';

jest.mock('../src/env', () => {
  return {
    PORT: port,
    COLLABORATION_SERVER_ORIGIN: origin,
    COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
  };
});

console.error = jest.fn();

import { hocusPocusServer } from '@/servers/hocusPocusServer';

import { initServer } from '../src/servers/appServer';

const { app, server } = initServer();
const apiEndpoint = '/collaboration/api/get-connections/';

describe('Server Tests', () => {
  afterAll(() => {
    server.close();
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] with incorrect API key should return 403', async () => {
    const response = await request(app as any)
      .get(`${apiEndpoint}?room=test-room`)
      .set('Origin', origin)
      .set('Authorization', 'wrong-api-key');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden: Invalid API Key');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] failed if room not indicated', async () => {
    const response = await request(app as any)
      .get(`${apiEndpoint}`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key')
      .send({ document_id: 'test-document' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Room name not provided');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] failed if session key not indicated', async () => {
    const response = await request(app as any)
      .get(`${apiEndpoint}?room=test-room`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key')
      .send({ document_id: 'test-document' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Session key not provided');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] return a 404 if room not found', async () => {
    const response = await request(app as any)
      .get(`${apiEndpoint}?room=test-room&sessionKey=test-session-key`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Room not found');
  });

  test('POST /collaboration/api/get-connections?room=[ROOM_ID] returns connection info, session key existing', async () => {
    const document = await hocusPocusServer.createDocument(
      'test-room',
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false, requiresAuthentication: true },
      {},
    );

    document.addConnection({
      webSocket: 1,
      context: { sessionKey: 'test-session-key' },
      document: document,
      pongReceived: false,
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
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);

    const response = await request(app as any)
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
    const document = await hocusPocusServer.createDocument(
      'test-room',
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false, requiresAuthentication: true },
      {},
    );

    document.addConnection({
      webSocket: 1,
      context: { sessionKey: 'test-session-key' },
      document: document,
      pongReceived: false,
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
      request: null,
      timeout: 0,
      socketId: uuid(),
      lock: null,
    } as any);

    const response = await request(app as any)
      .get(`${apiEndpoint}?room=test-room&sessionKey=non-existing-session-key`)
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      count: 3,
      exists: false,
    });
  });
});
