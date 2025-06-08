import request from 'supertest';

import { routes } from '@/routes';

const port = 5557;
const origin = 'http://localhost:3000';

jest.mock('../src/env', () => {
  return {
    PORT: port,
    COLLABORATION_SERVER_ORIGIN: origin,
  };
});

console.error = jest.fn();

import { initServer } from '../src/servers/appServer';

const { app, server } = initServer();

describe('Server Tests', () => {
  afterAll(() => {
    server.close();
  });

  test('Ping Pong', async () => {
    const response = await request(app as any).get('/ping');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('pong');
  });

  ['/collaboration/api/anything/', '/', '/anything'].forEach((path) => {
    test(`"${path}" endpoint should be forbidden`, async () => {
      const response = await request(app as any).post(path);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  it('should allow JSON payloads up to 500kb for the CONVERT_MARKDOWN route', async () => {
    const largePayload = 'a'.repeat(400 * 1024); // 400kb payload
    const response = await request(app)
      .post(routes.CONVERT_MARKDOWN)
      .send({ data: largePayload })
      .set('Content-Type', 'application/json');

    expect(response.status).not.toBe(413);
  });

  it('should reject JSON payloads larger than 500kb for the CONVERT_MARKDOWN route', async () => {
    const oversizedPayload = 'a'.repeat(501 * 1024); // 501kb payload
    const response = await request(app)
      .post(routes.CONVERT_MARKDOWN)
      .send({ data: oversizedPayload })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413);
  });

  it('should use the default JSON limit for other routes', async () => {
    const largePayload = 'a'.repeat(150 * 1024);
    const response = await request(app)
      .post('/some-other-route')
      .send({ data: largePayload })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413);
  });
});
