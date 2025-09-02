import {
  CommentBody,
  CommentData,
  DefaultThreadStoreAuth,
  ThreadData,
  ThreadStoreAuth,
  YjsThreadStoreBase,
} from '@blocknote/core/comments';
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

export function useComments(
  yDoc: Y.Doc,
  doc: Doc,
  user: User | null | undefined,
) {
  const threadStore = new CommentThreadStore(
    doc,
    yDoc.getMap('threads'),
    new DefaultThreadStoreAuth(user?.id || '', 'editor'),
  );

  return threadStore;
}

export class CommentThreadStore extends YjsThreadStoreBase {
  protected doc: Doc;
  constructor(doc: Doc, threadsYMap: Y.Map<unknown>, auth: ThreadStoreAuth) {
    super(threadsYMap, auth);

    this.doc = doc;
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
        head: unknown;
        anchor: unknown;
      };
    };
  }) => {
    const { threadId, ...body } = options;

    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        ...body,
      }),
    });

    console.log('threadId', threadId);
    console.log('body', body);
    console.log('response', response);

    if (!response.ok) {
      throw new APIError(
        'Failed to add thread to document',
        await errorCauses(response),
      );
    }

    //return response.json() as Promise<void>;

    // const { threadId, ...rest } = options;
    // return this.doRequest(`/${threadId}/addToDocument`, "POST", rest);
  };

  public createThread = async (options: {
    initialComment: {
      body: CommentBody;
      metadata?: unknown;
    };
    metadata?: unknown;
  }) => {
    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        ...options,
      }),
    });

    console.log('response', response);

    if (!response.ok) {
      throw new APIError(
        'Failed to create thread in document',
        await errorCauses(response),
      );
    }

    return response.json() as Promise<ThreadData>;
  };

  public addComment = async (options: {
    comment: {
      body: CommentBody;
      metadata?: unknown;
    };
    threadId: string;
  }) => {
    // const { threadId, ...rest } = options;
    // return this.doRequest(`/${threadId}/comments`, 'POST', rest);

    const { threadId, ...body } = options;

    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        ...body,
      }),
    });

    console.log('threadId', threadId);
    console.log('body', body);
    console.log('response', response);

    if (!response.ok) {
      throw new APIError(
        'Failed to add thread to document',
        await errorCauses(response),
      );
    }

    return response.json() as Promise<CommentData>;
  };

  public updateComment = async (options: {
    comment: {
      body: CommentBody;
      metadata?: unknown;
    };
    threadId: string;
    commentId: string;
  }) => {
    const { threadId, commentId, ...body } = options;
    // return this.doRequest(`/${threadId}/comments/${commentId}`, 'PUT', rest);

    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'PUT',
      body: JSON.stringify({
        ...body,
      }),
    });

    console.log('threadId', threadId);
    console.log('commentId', commentId);
    console.log('body', body);
    console.log('response', response);

    if (!response.ok) {
      throw new APIError(
        'Failed to add thread to document',
        await errorCauses(response),
      );
    }

    return response.json() as Promise<void>;
  };

  public deleteComment = async (options: {
    threadId: string;
    commentId: string;
    softDelete?: boolean;
  }) => {
    const { threadId, commentId, ...body } = options;
    // return this.doRequest(
    //   `/${threadId}/comments/${commentId}?soft=${!!rest.softDelete}`,
    //   'DELETE',
    // );

    console.log('threadId', threadId);
    console.log('commentId', commentId);
    console.log('softDelete', body);

    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to delete comment',
        await errorCauses(response),
      );
    }
  };

  public deleteThread = async (_options: { threadId: string }) => {
    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to delete thread',
        await errorCauses(response),
      );
    }
  };

  public resolveThread = async (_options: { threadId: string }) => {
    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to resolve thread',
        await errorCauses(response),
      );
    }
  };

  public unresolveThread = async (_options: { threadId: string }) => {
    const response = await fetchAPI(`documents/${this.doc.id}/comments/`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to unresolve thread',
        await errorCauses(response),
      );
    }
  };

  public addReaction = async (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    const { threadId, commentId, ...body } = options;
    const response = await fetchAPI(
      `documents/${this.doc.id}/comments/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...body,
        }),
      },
    );

    // return this.doRequest(
    //   `/${threadId}/comments/${commentId}/reactions`,
    //   'POST',
    //   rest,
    // );

    console.log('threadId', threadId);
    console.log('commentId', commentId);
    console.log('body', body);
    console.log('response', response);

    if (!response.ok) {
      throw new APIError(
        'Failed to add reaction to comment',
        await errorCauses(response),
      );
    }

    return response.json() as Promise<void>;
  };

  public deleteReaction = async (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    const response = await fetchAPI(
      `documents/${this.doc.id}/comments/reactions/${options.emoji}`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to delete reaction from comment',
        await errorCauses(response),
      );
    }
  };
}
