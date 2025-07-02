import { Hocuspocus } from '@hocuspocus/server';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    Y_PROVIDER_API_KEY: 'yprovider-api-key',
  };
});

import { initApp } from '@/servers';

import {
  Y_PROVIDER_API_KEY as apiKey,
  COLLABORATION_SERVER_ORIGIN as origin,
} from '../src/env';

console.error = vi.fn();

const mockOpts = {
  fallbackMockImplementation: () => {
    throw new Error('Unexpected call.');
  },
};

describe('Server Tests', () => {
  test('POST /api/convert with incorrect API key should responds with 403', async () => {
    const hocuspocus = mock<Hocuspocus>({}, mockOpts);
    const app = initApp(hocuspocus);

    const response = await request(app)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'wrong-api-key');

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({
      error: 'Forbidden: Invalid API Key',
    });
  });

  test('POST /api/convert with a Bearer token', async () => {
    const hocuspocus = mock<Hocuspocus>({}, mockOpts);
    const app = initApp(hocuspocus);

    const response = await request(app)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', 'Bearer test-secret-api-key');

    // Warning: Changing the authorization header to Bearer token format will break backend compatibility with this microservice.
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({
      error: 'Forbidden: Invalid API Key',
    });
  });

  test('POST /api/convert with missing body param content', async () => {
    const hocuspocus = mock<Hocuspocus>({}, mockOpts);
    const app = initApp(hocuspocus);

    const response = await request(app)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', apiKey);

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });

  test('POST /api/convert with body param content being an empty string', async () => {
    const hocuspocus = mock<Hocuspocus>({}, mockOpts);
    const app = initApp(hocuspocus);

    const response = await request(app)
      .post('/api/convert')
      .set('Origin', origin)
      .set('Authorization', apiKey)
      .send({
        content: '',
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });
});
