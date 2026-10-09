import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

import { routes } from '@/routes';
import { initApp } from '@/servers';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    CONVERSION_FILE_MAX_SIZE: 500 * 1024, // 500kb
  };
});

import { JWKS_URL, COLLABORATION_SERVER_ORIGIN as origin } from '../src/env';

import { mockJwksEndpoint, signAdminToken } from './testUtils/adminJwt';

console.error = vi.fn();

describe('Server Tests', () => {
  beforeEach(() => {
    mockJwksEndpoint(JWKS_URL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Ping Pong', async () => {
    const app = initApp();

    const response = await request(app).get('/ping');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ message: 'pong' });
  });

  ['/collaboration/api/anything/', '/', '/anything'].forEach((path) => {
    test(`"${path}" endpoint should be forbidden`, async () => {
      const app = initApp();

      const response = await request(app).post(path);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  it('allows payloads up to 500kb for the CONVERT route', async () => {
    const app = initApp();
    const apiKey = await signAdminToken();

    const largePayload = 'a'.repeat(400 * 1024); // 400kb payload
    const response = await request(app)
      .post(routes.CONVERT)
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'text/markdown')
      .send(largePayload);

    expect(response.status).not.toBe(413);
  });

  it('rejects payloads larger than CONVERSION_FILE_MAX_SIZE for the CONVERT route', async () => {
    const app = initApp();
    const apiKey = await signAdminToken();

    const oversizedPayload = 'a'.repeat(501 * 1024); // 501kb payload
    const response = await request(app)
      .post(routes.CONVERT)
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'text/markdown')
      .send(oversizedPayload);

    expect(response.status).toBe(413);
  });
});
