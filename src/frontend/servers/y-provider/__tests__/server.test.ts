import request from 'supertest';
import { describe, expect, it, test, vi } from 'vitest';

import { routes } from '@/routes';
import { initApp } from '@/servers';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
  };
});

console.error = vi.fn();

describe('Server Tests', () => {
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

  it('allows JSON payloads up to 500kb for the CONVERT route', async () => {
    const app = initApp();

    const largePayload = 'a'.repeat(400 * 1024); // 400kb payload
    const response = await request(app)
      .post(routes.CONVERT)
      .send({ data: largePayload })
      .set('Content-Type', 'application/json');

    expect(response.status).not.toBe(413);
  });

  it('rejects JSON payloads larger than 500kb for the CONVERT route', async () => {
    const app = initApp();

    const oversizedPayload = 'a'.repeat(501 * 1024); // 501kb payload
    const response = await request(app)
      .post(routes.CONVERT)
      .send({ data: oversizedPayload })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413);
  });

  it('uses the default JSON limit for other routes', async () => {
    const app = initApp();

    const largePayload = 'a'.repeat(150 * 1024);
    const response = await request(app)
      .post('/some-other-route')
      .send({ data: largePayload })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413);
  });
});
