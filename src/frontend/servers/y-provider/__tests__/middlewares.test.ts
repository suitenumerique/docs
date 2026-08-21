import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { JWKS_URL } = vi.hoisted(() => ({
  JWKS_URL: 'http://app-dev:8000/api/v1.0/jwks',
}));

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    JWKS_URL,
  };
});

import { httpSecurity } from '@/middlewares';

import {
  mockJwksEndpoint,
  signAdminToken,
  signAdminTokenForAudience,
  signAdminTokenWithWrongKey,
  signExpiredAdminToken,
  signToken,
} from './testUtils/adminJwt';

const buildApp = () => {
  const app = express();
  app.get('/protected', httpSecurity, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
};

describe('httpSecurity', () => {
  beforeEach(() => {
    mockJwksEndpoint(JWKS_URL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects requests without an authorization header', async () => {
    const response = await request(buildApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: No credentials given',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts a valid admin JWT signed by the Django backend', async () => {
    const token = await signAdminToken();

    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    // Verified against the real JWKS document served over the (mocked) network.
    expect(fetch).toHaveBeenCalledWith(JWKS_URL, expect.anything());
  });

  it('rejects a token signed with a key that is not in the JWKS', async () => {
    const token = await signAdminTokenWithWrongKey();

    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  it('rejects an expired admin JWT', async () => {
    const token = await signExpiredAdminToken();

    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  it('rejects a valid admin JWT issued for another audience', async () => {
    const token = await signAdminTokenForAudience('some-other-service');

    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  it('rejects a validly signed JWT missing the admin claim', async () => {
    const token = await signToken({ sub: 'someone' });

    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  it('rejects a bearer token that is not a valid JWT', async () => {
    const response = await request(buildApp())
      .get('/protected')
      .set('authorization', 'Bearer wrong-token');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });
});
