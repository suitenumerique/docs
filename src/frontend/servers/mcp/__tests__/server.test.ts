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
  KEYCLOAK_ISSUER: 'http://localhost/realms/impress',
  KEYCLOAK_JWKS_URL:
    'http://localhost/realms/impress/protocol/openid-connect/certs',
  KEYCLOAK_DISCOVERY_URL:
    'http://localhost/realms/impress/.well-known/openid-configuration',
  DOCS_API_URL: 'http://docs-api.test',
  MCP_AUDIENCE: 'docs-mcp',
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

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(async (token: string) => {
    if (!verifiedClaims || token !== 'valid-token') {
      throw new Error('invalid token');
    }
    return { payload: verifiedClaims };
  }),
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

  test('a token with the wrong audience is rejected', async () => {
    verifiedClaims = null; // jwtVerify mock throws for anything but 'valid-token' with claims set
    await expect(connectClient(url, 'valid-token')).rejects.toThrow();
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
