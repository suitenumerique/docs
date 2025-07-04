import request from 'supertest';

const port = 5556;
const origin = 'http://localhost:3000';

jest.mock('../src/env', () => {
  return {
    PORT: port,
    COLLABORATION_SERVER_ORIGIN: origin,
    Y_PROVIDER_API_KEY: 'yprovider-api-key',
  };
});

import { initServer } from '../src/servers/appServer';

console.error = jest.fn();
const { app, server } = initServer();

describe('Server Tests', () => {
  afterAll(() => {
    server.close();
  });

  test('POST /api/convert with incorrect API key should return 403', async () => {
    const response = await request(app as any)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'wrong-api-key');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden: Invalid API Key');
  });

  test('POST /api/convert with a Bearer token', async () => {
    const response = await request(app as any)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'Bearer test-secret-api-key');

    // Warning: Changing the authorization header to Bearer token format will break backend compatibility with this microservice.
    expect(response.status).toBe(403);
  });

  test('POST /api/convert with missing body param content', async () => {
    const response = await request(app as any)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'yprovider-api-key');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request: missing content');
  });

  test('POST /api/convert with body param content being an empty string', async () => {
    const response = await request(app as any)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'yprovider-api-key')
      .send({
        content: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request: missing content');
  });
});
