import { CommentBody, ThreadStore } from '@blocknote/core/comments';
import type { Awareness } from 'y-protocols/awareness';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/features/docs/doc-management';

import { useEditorStore } from '../../stores';

import { DocsThreadStoreAuth } from './DocsThreadStoreAuth';
import {
  ClientCommentData,
  ClientThreadData,
  ServerComment,
  ServerReaction,
  ServerThread,
} from './types';

type ServerThreadListResponse = APIList<ServerThread>;

export class DocsThreadStore extends ThreadStore {
  protected static COMMENTS_PING = 'commentsPing';
  protected threads: Map<string, ClientThreadData> = new Map();
  private subscribers = new Set<
    (threads: Map<string, ClientThreadData>) => void
  >();
  private awareness?: Awareness;
  private lastPingAt = 0;
  private pingTimer?: ReturnType<typeof setTimeout>;

  constructor(
    protected docId: Doc['id'],
    awareness: Awareness | undefined,
    protected docAuth: DocsThreadStoreAuth,
  ) {
    super(docAuth);

    if (docAuth.canSee) {
      this.awareness = awareness;
      this.awareness?.on('update', this.onAwarenessUpdate);
      void this.refreshThreads();
    }
  }

  public destroy() {
    this.awareness?.off('update', this.onAwarenessUpdate);
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
    }
  }

  private onAwarenessUpdate = async ({
    added,
    updated,
  }: {
    added: number[];
    updated: number[];
  }) => {
    if (!this.awareness) {
      return;
    }
    const states = this.awareness.getStates();
    const listClientIds = [...added, ...updated];
    for (const clientId of listClientIds) {
      // Skip our own client ID
      if (clientId === this.awareness.clientID) {
        continue;
      }

      const state = states.get(clientId) as
        | {
            [DocsThreadStore.COMMENTS_PING]?: {
              at: number;
              docId: string;
              isResolving: boolean;
              threadId: string;
            };
          }
        | undefined;

      const ping = state?.commentsPing;

      // Skip if no ping information is available
      if (!ping) {
        continue;
      }

      // Skip if the document ID doesn't match
      if (ping.docId !== this.docId) {
        continue;
      }

      // Skip if the ping timestamp is past
      if (ping.at <= this.lastPingAt) {
        continue;
      }

      this.lastPingAt = ping.at;

      // If we know the threadId, schedule a targeted refresh. Otherwise, fall back to full refresh.
      if (ping.threadId) {
        await this.refreshThread(ping.threadId);
      } else {
        await this.refreshThreads();
      }
    }
  };

  /**
   * To ping the other clients for updates on a specific thread
   * @param threadId
   */
  private ping(threadId?: string) {
    this.awareness?.setLocalStateField(DocsThreadStore.COMMENTS_PING, {
      at: Date.now(),
      docId: this.docId,
      threadId,
    });
  }

  /**
   * Notifies all subscribers about the current thread state
   */
  private notifySubscribers() {
    // Always emit a new Map reference to help consumers detect changes
    const threads = new Map(this.threads);
    this.subscribers.forEach((cb) => {
      try {
        cb(threads);
      } catch (e) {
        console.warn('DocsThreadStore subscriber threw', e);
      }
    });
  }

  private upsertClientThreadData(thread: ClientThreadData) {
    const next = new Map(this.threads);
    next.set(thread.id, thread);
    this.threads = next;
  }

  private removeThread(threadId: string) {
    const next = new Map(this.threads);
    next.delete(threadId);
    this.threads = next;
  }

  /**
   * To subscribe to thread updates
   * @param cb
   * @returns
   */
  public subscribe(cb: (threads: Map<string, ClientThreadData>) => void) {
    if (!this.docAuth.canSee) {
      return () => {};
    }

    this.subscribers.add(cb);

    // Emit initial state asynchronously to avoid running during editor init
    setTimeout(() => {
      if (this.subscribers.has(cb)) {
        cb(this.getThreads());
      }
    }, 0);

    return () => {
      this.subscribers.delete(cb);
    };
  }

  public addThreadToDocument = (options: {
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
    const { threadId } = options;
    const { editor } = useEditorStore.getState();

    // Should not happen
    if (!editor) {
      console.warn('Editor to add thread not ready');
      return Promise.resolve();
    }

    editor._tiptapEditor
      .chain()
      .focus?.()
      .setMark?.('comment', { orphan: false, threadId })
      .run?.();

    return Promise.resolve();
  };

  public createThread = async (options: {
    initialComment: {
      body: CommentBody;
      metadata?: unknown;
    };
    metadata?: unknown;
  }) => {
    const response = await fetchAPI(`documents/${this.docId}/threads/`, {
      method: 'POST',
      body: JSON.stringify({
        body: options.initialComment.body,
      }),
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to create thread in document',
        await errorCauses(response),
      );
    }

    const thread = (await response.json()) as ServerThread;
    const threadData: ClientThreadData = serverThreadToClientThread(thread);
    this.upsertClientThreadData(threadData);
    this.notifySubscribers();
    this.ping(threadData.id);
    return threadData;
  };

  public getThread(threadId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    return thread;
  }

  public getThreads(): Map<string, ClientThreadData> {
    if (!this.docAuth.canSee) {
      return new Map();
    }

    return this.threads;
  }

  public async refreshThread(threadId: string) {
    const response = await fetchAPI(
      `documents/${this.docId}/threads/${threadId}/`,
      { method: 'GET' },
    );

    // If not OK and 404, the thread might have been deleted but the
    // thread modal is still open, so we close it to avoid side effects
    if (response.status === 404) {
      // use escape key event to close the thread modal
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
          cancelable: true,
        }),
      );

      await this.refreshThreads();
      return;
    }

    if (!response.ok) {
      throw new APIError(
        `Failed to fetch thread ${threadId}`,
        await errorCauses(response),
      );
    }

    const serverThread = (await response.json()) as ServerThread;

    const clientThread = serverThreadToClientThread(serverThread);
    this.upsertClientThreadData(clientThread);
    this.notifySubscribers();
  }

  public async refreshThreads(): Promise<void> {
    const response = await fetchAPI(`documents/${this.docId}/threads/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to get threads in document',
        await errorCauses(response),
      );
    }

    const threads = (await response.json()) as ServerThreadListResponse;
    const next = new Map<string, ClientThreadData>();
    threads.results.forEach((thread) => {
      const threadData: ClientThreadData = serverThreadToClientThread(thread);
      next.set(thread.id, threadData);
    });
    this.threads = next;
    this.notifySubscribers();
  }

  public addComment = async (options: {
    comment: {
      body: CommentBody;
      metadata?: unknown;
    };
    threadId: string;
  }) => {
    const { threadId } = options;

    const response = await fetchAPI(
      `documents/${this.docId}/threads/${threadId}/comments/`,
      {
        method: 'POST',
        body: JSON.stringify({
          body: options.comment.body,
        }),
      },
    );

    if (!response.ok) {
      throw new APIError('Failed to add comment ', await errorCauses(response));
    }

    const comment = (await response.json()) as ServerComment;

    // Optimistically update local thread with new comment
    const existing = this.threads.get(threadId);
    if (existing) {
      const updated: ClientThreadData = {
        ...existing,
        updatedAt: new Date(comment.updated_at || comment.created_at),
        comments: [...existing.comments, serverCommentToClientComment(comment)],
      };
      this.upsertClientThreadData(updated);
      this.notifySubscribers();
    } else {
      // Fallback to fetching the thread if we don't have it locally
      await this.refreshThread(threadId);
    }
    this.ping(threadId);
    return serverCommentToClientComment(comment);
  };

  public updateComment = async (options: {
    comment: {
      body: CommentBody;
      metadata?: unknown;
    };
    threadId: string;
    commentId: string;
  }) => {
    const { threadId, commentId, comment } = options;

    const response = await fetchAPI(
      `documents/${this.docId}/threads/${threadId}/comments/${commentId}/`,
      {
        method: 'PUT',
        body: JSON.stringify({
          body: comment.body,
        }),
      },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to add thread to document',
        await errorCauses(response),
      );
    }

    await this.refreshThread(threadId);
    this.ping(threadId);

    return;
  };

  public deleteComment = async (options: {
    threadId: string;
    commentId: string;
    softDelete?: boolean;
  }) => {
    const { threadId, commentId } = options;

    const response = await fetchAPI(
      `documents/${this.docId}/threads/${threadId}/comments/${commentId}/`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to delete comment',
        await errorCauses(response),
      );
    }

    // Optimistically remove the comment locally if we have the thread
    const existing = this.threads.get(threadId);
    if (existing) {
      const updated: ClientThreadData = {
        ...existing,
        updatedAt: new Date(),
        comments: existing.comments.filter((c) => c.id !== commentId),
      };
      this.upsertClientThreadData(updated);
      this.notifySubscribers();
    } else {
      // Fallback to fetching the thread
      await this.refreshThread(threadId);
    }
    this.ping(threadId);
  };

  /**
   * UI not implemented
   * @param _options
   */
  public deleteThread = async (_options: { threadId: string }) => {
    const response = await fetchAPI(
      `documents/${this.docId}/threads/${_options.threadId}/`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to delete thread',
        await errorCauses(response),
      );
    }

    // Remove locally and notify; no need to refetch everything
    this.removeThread(_options.threadId);
    this.notifySubscribers();
    this.ping(_options.threadId);
  };

  public resolveThread = async (_options: { threadId: string }) => {
    const { threadId } = _options;

    const response = await fetchAPI(
      `documents/${this.docId}/threads/${threadId}/resolve/`,
      { method: 'POST' },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to resolve thread',
        await errorCauses(response),
      );
    }

    await this.refreshThreads();
    this.ping(threadId);
  };

  /**
   * Todo: Not implemented backend side
   * @returns
   * @throws
   */
  public unresolveThread = async (_options: { threadId: string }) => {
    const response = await fetchAPI(
      `documents/${this.docId}/threads/${_options.threadId}/unresolve/`,
      { method: 'POST' },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to unresolve thread',
        await errorCauses(response),
      );
    }

    await this.refreshThread(_options.threadId);
    this.ping(_options.threadId);
  };

  public addReaction = async (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    const response = await fetchAPI(
      `documents/${this.docId}/threads/${options.threadId}/comments/${options.commentId}/reactions/`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji: options.emoji }),
      },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to add reaction to comment',
        await errorCauses(response),
      );
    }

    await this.refreshThread(options.threadId);
    this.notifySubscribers();
    this.ping(options.threadId);
  };

  public deleteReaction = async (options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }) => {
    const response = await fetchAPI(
      `documents/${this.docId}/threads/${options.threadId}/comments/${options.commentId}/reactions/`,
      { method: 'DELETE', body: JSON.stringify({ emoji: options.emoji }) },
    );

    if (!response.ok) {
      throw new APIError(
        'Failed to delete reaction from comment',
        await errorCauses(response),
      );
    }

    await this.refreshThread(options.threadId);
    this.notifySubscribers();
    this.ping(options.threadId);
  };
}

const serverReactionToReactionData = (r: ServerReaction) => {
  return {
    emoji: r.emoji,
    createdAt: new Date(r.created_at),
    userIds: r.users?.map((user) =>
      encodeURIComponent(user.full_name || ''),
    ) || [''],
  };
};

const serverCommentToClientComment = (c: ServerComment): ClientCommentData => ({
  type: 'comment',
  id: c.id,
  userId: encodeURIComponent(c.user?.full_name || ''),
  body: c.body,
  createdAt: new Date(c.created_at),
  updatedAt: new Date(c.updated_at),
  reactions: (c.reactions ?? []).map(serverReactionToReactionData),
  metadata: { abilities: c.abilities },
});

const serverThreadToClientThread = (t: ServerThread): ClientThreadData => ({
  type: 'thread',
  id: t.id,
  createdAt: new Date(t.created_at),
  updatedAt: new Date(t.updated_at),
  comments: (t.comments ?? []).map(serverCommentToClientComment),
  resolved: t.resolved,
  resolvedUpdatedAt: t.resolved_updated_at
    ? new Date(t.resolved_updated_at)
    : undefined,
  resolvedBy: t.resolved_by || undefined,
  metadata: { abilities: t.abilities, metadata: t.metadata },
});
