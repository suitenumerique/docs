/**
 * Thin client for the Docs API's MCP-facing endpoints (`core/mcp_api` on the Django side).
 *
 * The MCP server is a plain OAuth resource server: it validates the caller's Keycloak access
 * token (see `auth/jwtVerifier.ts`) and forwards that same token, unchanged, to Django. Django
 * introspects it (django-lasuite's `ResourceServerAuthentication`), checks the token's origin
 * client is allow-listed (`OIDC_RS_ALLOWED_AUDIENCES`), resolves the user by `sub`, and its
 * `DocumentViewSet` permissions/querysets decide what that user can actually see or create.
 * This is the same mechanism the (separate) `external_api` feature uses — see
 * `documentation/resource_server.md`.
 */

import axios from 'axios';

import { DOCS_API_URL } from '@/env.js';

import type { McpAuthContext } from './auth/context.js';

export type DocumentSummary = {
  id: string;
  title: string | null;
  excerpt: string | null;
  updated_at: string;
  children_ids: string[];
};

export type DocumentContent = {
  id: string;
  title: string | null;
  content: string;
  truncated: boolean;
  updated_at: string;
};

export type DocumentCreated = {
  id: string;
  title: string | null;
  created_at: string;
};

/** Thrown with a message that is safe to surface directly to an MCP tool caller. */
export class DocsApiError extends Error {}

function detailFromResponse(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'detail' in data) {
    const { detail } = data;
    return typeof detail === 'string' ? detail : undefined;
  }
  return undefined;
}

async function docsApiRequest<T>(
  auth: McpAuthContext,
  config: { method: 'GET' | 'POST'; path: string; data?: unknown },
): Promise<T> {
  try {
    const response = await axios.request<T>({
      method: config.method,
      url: `${DOCS_API_URL}${config.path}`,
      data: config.data,
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new DocsApiError(
          detailFromResponse(error.response.data) ??
            `Docs API request failed with status ${error.response.status}.`,
        );
      }
      throw new DocsApiError('Docs API is unreachable.');
    }
    throw error;
  }
}

export function searchDocuments(
  auth: McpAuthContext,
  query: string,
  limit: number,
): Promise<DocumentSummary[]> {
  return docsApiRequest(auth, {
    method: 'POST',
    path: '/api/v1.0/mcp/documents/search',
    data: { query, limit },
  });
}

export function readDocument(
  auth: McpAuthContext,
  documentId: string,
): Promise<DocumentContent> {
  return docsApiRequest(auth, {
    method: 'GET',
    path: `/api/v1.0/mcp/documents/${documentId}`,
  });
}

export function createDocument(
  auth: McpAuthContext,
  input: { title: string; content: string; parentId?: string },
): Promise<DocumentCreated> {
  return docsApiRequest(auth, {
    method: 'POST',
    path: '/api/v1.0/mcp/documents',
    data: {
      title: input.title,
      content: input.content,
      parent_id: input.parentId,
    },
  });
}
