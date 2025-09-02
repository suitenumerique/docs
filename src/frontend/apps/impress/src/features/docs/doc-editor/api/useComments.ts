import {
  DefaultThreadStoreAuth,
  RESTYjsThreadStore,
  ThreadStoreAuth,
  YjsThreadStoreBase,
} from '@blocknote/core/comments';
import * as Y from 'yjs';

import { fetchAPI, getCSRFToken } from '@/api';
import { baseApiUrl } from '@/api/config';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

export function useComments(
  yDoc: Y.Doc,
  doc: Doc,
  user: User | null | undefined,
) {
  const apiUrl = `${baseApiUrl('1.0')}documents/${doc.id}/comments/`;
  const csrfToken = getCSRFToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRFToken': csrfToken }),
  };

  // --- Ensure credentials (cookies) are sent for the comments REST calls -----------------
  // RESTYjsThreadStore internally uses the global fetch API and doesn't expose a way to
  // force credentials: 'include'. Since our backend auth relies on cookies, we wrap
  // globalThis.fetch ONCE to inject credentials only for this specific comments endpoint.
  // The wrapper is idempotent and narrowly scoped to URLs starting with apiUrl.
  // If later the upstream library adds a credentials option, this can be removed.
  type PatchedFetch = typeof fetch & { __impressCommentsPatched?: boolean };
  const g = globalThis as { fetch: PatchedFetch };
  if (typeof g.fetch === 'function' && !g.fetch.__impressCommentsPatched) {
    const originalFetch = g.fetch.bind(globalThis);
    const prefix = apiUrl; // already absolute from baseApiUrl
    const patchedFetch: PatchedFetch = (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      try {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (urlStr.startsWith(prefix)) {
          return originalFetch(input, { ...init, credentials: 'include' });
        }
      } catch {
        // ignore and fallback
      }
      return originalFetch(input, init);
    };
    patchedFetch.__impressCommentsPatched = true;
    g.fetch = patchedFetch;
  }
  // ---------------------------------------------------------------------------------------

  const threadStore = new RESTYjsThreadStore(
    apiUrl,
    headers,
    yDoc.getMap('threads'),
    new DefaultThreadStoreAuth(user?.id || '', 'editor'),
  );

  return threadStore;
}

export class RESTYjsThreadStore2 extends YjsThreadStoreBase {
  constructor(
    private readonly BASE_URL: string,
    private readonly headers: Record<string, string>,
    threadsYMap: Y.Map<unknown>,
    auth: ThreadStoreAuth,
  ) {
    super(threadsYMap, auth);
  }

  // private doRequest = async (path: string, method: string, body?: any) => {
  //   const response = await fetch(`${this.BASE_URL}${path}`, {
  //     method,
  //     body: JSON.stringify(body),
  //     headers: {
  //       'Content-Type': 'application/json',
  //       ...this.headers,
  //     },
  //   });

  //   if (!response.ok) {
  //     throw new Error(`Failed to ${method} ${path}: ${response.statusText}`);
  //   }

  //   return response.json();
  // };

  public addThreadToDocument = async (options: {
    threadId: string;
    selection: {
      prosemirror: {
        head: number;
        anchor: number;
      };
      yjs: {
        head: any;
        anchor: any;
      };
    };
  }) => {
    const { threadId, ...rest } = options;

    const response = await fetchAPI(`documents/${docId}/ai-transform/`, {
      method: 'POST',
      body: JSON.stringify({
        ...params,
      }),
    });

    return this.doRequest(`/${threadId}/addToDocument`, 'POST', rest);
  };

  public createThread = async (options: {
    initialComment: {
      body: CommentBody;
      metadata?: any;
    };
    metadata?: any;
  }) => {
    return this.doRequest('', 'POST', options);
  };

  public addComment = (options: {
    comment: {
      body: CommentBody;
      metadata?: any;
    };
    threadId: string;
  }) => {
    const { threadId, ...rest } = options;
    return this.doRequest(`/${threadId}/comments`, 'POST', rest);
  };

  public updateComment = (options: {
    comment: {
      body: CommentBody;
      metadata?: any;
    };
    threadId: string;
    commentId: string;
  }) => {
    const { threadId, commentId, ...rest } = options;
    return this.doRequest(`/${threadId}/comments/${commentId}`, 'PUT', rest);
  };

  public deleteComment = (options: {
    threadId: string;
    commentId: string;
    softDelete?: boolean;
  }) => {
    const { threadId, commentId, ...rest } = options;
    return this.doRequest(
      `/${threadId}/comments/${commentId}?soft=${!!rest.softDelete}`,
      'DELETE',
    );
  };

  public deleteThread = (options: { threadId: string }) => {
    return this.doRequest(`/${options.threadId}`, 'DELETE');
  };

  public resolveThread = (options: { threadId: string }) => {
    return this.doRequest(`/${options.threadId}/resolve`, 'POST');
  };

  public unresolveThread = (options: { threadId: string }) => {
    return this.doRequest(`/${options.threadId}/unresolve`, 'POST');
  };

  public addReaction = (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    const { threadId, commentId, ...rest } = options;
    return this.doRequest(
      `/${threadId}/comments/${commentId}/reactions`,
      'POST',
      rest,
    );
  };

  public deleteReaction = (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    return this.doRequest(
      `/${options.threadId}/comments/${options.commentId}/reactions/${options.emoji}`,
      'DELETE',
    );
  };
}
