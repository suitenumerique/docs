/* eslint-disable jest/unbound-method */
/**
 * A handful of focused tests, not an exhaustive suite: unauthenticated / wrong-audience /
 * missing-scope / bad-input rejections, and one happy path
 * proving a valid call reaches Django with the caller's token forwarded unchanged. Django HTTP
 * calls are mocked; JWT verification is mocked to avoid depending on a live JWKS.
 *
 * `expect(mockedAxios.post)`-style assertions below trip the unbound-method rule even though
 * vitest's mocked functions don't rely on `this`; disabled for this file rather than annotated
 * line by line.
 */

import { type Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import axios from 'axios';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

vi.mock('@/env.js', () => ({
  MCP_HOST: '127.0.0.1',
  MCP_PORT: 0,
  MCP_RESOURCE_URL: 'http://localhost:4455/mcp',
  MCP_OIDC_ISSUER: 'http://localhost/realms/impress',
  MCP_OIDC_JWKS_URL:
    'http://localhost/realms/impress/protocol/openid-connect/certs',
  MCP_OIDC_DISCOVERY_URL:
    'http://localhost/realms/impress/.well-known/openid-configuration',
  DOCS_API_URL: 'http://docs-api.test',
  MCP_AUDIENCE_CLAIM: 'aud',
  MCP_ALLOWED_AUDIENCES: ['docs-mcp'],
  MCP_EXTRA_SCOPES: ['docs-mcp'],
}));

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

type FakeTokenClaims = {
  sub: string;
  aud: string;
  scope: string;
  exp: number;
};

let verifiedClaims: FakeTokenClaims | null = null;

// Stands in for jose's signature/issuer checks; the audience check is emulated so the
// verifier's `audience` option is exercised end to end (see jwtVerifier.test.ts for the real
// jose-backed claim checks).
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(
    async (
      token: string,
      _jwks: unknown,
      options?: { audience?: string[] },
    ) => {
      if (!verifiedClaims || token !== 'valid-token') {
        throw new Error('invalid token');
      }
      if (options?.audience && !options.audience.includes(verifiedClaims.aud)) {
        throw new Error('unexpected "aud" claim value');
      }
      return { payload: verifiedClaims };
    },
  ),
}));

import { createApp } from '@/server.js';

async function startServer(): Promise<{ server: Server; url: string }> {
  const app = await createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/mcp` };
}

async function connectClient(url: string, token?: string) {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(transport);
  return client;
}

describe('docs-mcp server', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        issuer: 'http://localhost/realms/impress',
        authorization_endpoint:
          'http://localhost/realms/impress/protocol/openid-connect/auth',
        token_endpoint:
          'http://localhost/realms/impress/protocol/openid-connect/token',
        response_types_supported: ['code'],
      },
    });
    ({ server, url } = await startServer());
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    verifiedClaims = null;
    mockedAxios.post.mockReset();
    mockedAxios.request.mockReset();
  });

  test('a request without a token is rejected with 401', async () => {
    await expect(connectClient(url)).rejects.toThrow();
  });

  test('an invalid token is rejected with 401', async () => {
    const response = await request(server)
      .post('/mcp')
      .set('Authorization', 'Bearer not-a-valid-token')
      .send({});

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toContain('invalid_token');
  });

  test('a token with the wrong audience is rejected with 401', async () => {
    verifiedClaims = {
      sub: 'user-1',
      aud: 'another-app',
      scope: 'docs:documents:search',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const response = await request(server)
      .post('/mcp')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(401);
    await expect(connectClient(url, 'valid-token')).rejects.toThrow();
  });

  test('the protected resource metadata advertises the tool and extra scopes', async () => {
    const response = await request(server).get(
      '/.well-known/oauth-protected-resource/mcp',
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: 'http://localhost:4455/mcp',
      authorization_servers: ['http://localhost/realms/impress'],
      scopes_supported: [
        'docs:documents:search',
        'docs:documents:read',
        'docs:documents:create',
        'docs-mcp',
      ],
    });
  });

  test('a tool call without its required scope is rejected', async () => {
    verifiedClaims = {
      sub: 'user-1',
      aud: 'docs-mcp',
      scope: 'docs:documents:read', // missing docs:documents:search
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const client = await connectClient(url, 'valid-token');
    const result = await client.callTool({
      name: 'search_documents',
      arguments: { query: 'hello' },
    });

    expect(result.isError).toBe(true);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test('invalid tool input is rejected', async () => {
    verifiedClaims = {
      sub: 'user-1',
      aud: 'docs-mcp',
      scope: 'docs:documents:search',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const client = await connectClient(url, 'valid-token');
    const result = await client.callTool({
      name: 'search_documents',
      arguments: { query: '' }, // empty query violates min(1)
    });

    expect(result.isError).toBe(true);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test('a valid tool call forwards the caller token to the expected Django endpoint', async () => {
    verifiedClaims = {
      sub: 'user-1',
      aud: 'docs-mcp',
      scope: 'docs:documents:search',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    mockedAxios.request.mockResolvedValueOnce({
      data: [
        {
          id: 'doc-1',
          title: 'Hello',
          excerpt: 'World',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const client = await connectClient(url, 'valid-token');
    const result = await client.callTool({
      name: 'search_documents',
      arguments: { query: 'hello' },
    });

    expect(result.isError).toBeFalsy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'http://docs-api.test/api/v1.0/mcp/documents/search',
        headers: { Authorization: 'Bearer valid-token' },
      }),
    );
  });
});
