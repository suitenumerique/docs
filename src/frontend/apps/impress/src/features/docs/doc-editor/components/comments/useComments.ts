/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommentBody,
  CommentData,
  DefaultThreadStoreAuth,
  ThreadData,
  ThreadStoreAuth,
  YjsThreadStoreBase,
} from '@blocknote/core/comments';
// (EditorState no longer needed after refactor)
import { useEffect, useMemo, useState } from 'react';
import {
  relativePositionToAbsolutePosition as relPosToAbs,
  ySyncPluginKey,
} from 'y-prosemirror';
// (Previously used low-level helpers removed in favor of ySync plugin state)
import * as Y from 'yjs';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

import { useEditorStore } from '../../stores';

import { threadToYMap, yMapToThread } from './yjsHelpers';

interface CommentThreadAbilities {
  destroy: boolean;
  update: boolean;
  partial_update: boolean;
  retrieve: boolean;
}

interface CommentThreadApiResponse {
  id: string;
  content: any;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  user: User;
  document: string; // Document UUID
  abilities: CommentThreadAbilities;
}

type CommentThreadApiListResponse = APIList<CommentThreadApiResponse>;

// Shape we expect to have sent when creating a thread.
interface ThreadCreationContent {
  initialComment: {
    body: CommentBody;
    metadata?: unknown;
  };
  metadata?: unknown;
}

export function useComments(
  yDoc: Y.Doc,
  doc: Doc,
  user: User | null | undefined,
) {
  const threadStore = useMemo(() => {
    return new CommentThreadStore(
      doc.id,
      yDoc,
      new DefaultThreadStoreAuth(user?.id || '', 'editor'),
    );
  }, [doc.id, yDoc, user?.id]);

  return threadStore;
}

export class CommentThreadStore extends YjsThreadStoreBase {
  protected threads: Map<string, ThreadData> = new Map();

  constructor(
    protected docId: Doc['id'],
    protected yDoc: Y.Doc,
    auth: ThreadStoreAuth,
  ) {
    super(yDoc.getMap('threads'), auth);

    void this.refreshThreadsFromServer();
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
    const { threadId, selection } = options;

    console.log('addThreadToptions', options);
    try {
      const { editor } = useEditorStore.getState();
      if (!editor) {
        console.warn('addThreadToDocument: editor not ready');
        return Promise.resolve();
      }
      interface TiptapLikeView {
        // We intentionally relax typing here because BlockNote's internal
        // ProseMirror EditorView state shape isn't exported with full types.
        // Using any prevents TS structural mismatch errors with ySyncPluginKey.getState.
        state: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        dispatch: (tr: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const view: TiptapLikeView | undefined = editor.prosemirrorView;
      if (!view) {
        console.warn('addThreadToDocument: view not ready');
        return Promise.resolve();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const yState = ySyncPluginKey.getState(view.state) as {
        mapping: any;
        type: any;
      } | null;
      if (!yState) {
        console.warn('addThreadToDocument: ySync plugin state missing');
        return Promise.resolve();
      }
      const { mapping, type: yFragment } = yState;

      // Attempt relative -> absolute conversion with fallback.
      const tryRel = (label: string, relPos: unknown): number | null => {
        try {
          const v = relPosToAbs(this.yDoc, yFragment, relPos as any, mapping);
          if (typeof v === 'number') {
            return v;
          }
        } catch (err) {
          console.warn(
            `addThreadToDocument: relative->abs failed for ${label}`,
            err,
          );
        }
        return null;
      };

      let anchorAbs = tryRel('anchor', selection.yjs.anchor);
      let headAbs = tryRel('head', selection.yjs.head);

      if (anchorAbs == null || headAbs == null) {
        anchorAbs = selection.prosemirror.anchor;
        headAbs = selection.prosemirror.head;
      }

      if (anchorAbs == null || headAbs == null) {
        console.warn('addThreadToDocument: could not resolve any positions');
        return Promise.resolve();
      }

      const from = Math.min(anchorAbs, headAbs);
      const to = Math.max(anchorAbs, headAbs);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const markType = view.state.schema.marks['comment'];
      if (!markType) {
        console.warn('addThreadToDocument: comment mark type missing');
        return Promise.resolve();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
      const tr = view.state.tr.addMark(
        from,
        to,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        markType.create({ orphan: false, threadId }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      view.dispatch(tr);
    } catch (e) {
      console.error('addThreadToDocument failed', e);
    }
    return Promise.resolve();
  };

  public createThread = async (options: {
    initialComment: {
      body: CommentBody;
      metadata?: unknown;
    };
    metadata?: unknown;
  }) => {
    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        content: options,
      }),
    });

    console.log('createThread');

    if (!response.ok) {
      throw new APIError(
        'Failed to create thread in document',
        await errorCauses(response),
      );
    }

    const thread = (await response.json()) as CommentThreadApiResponse;
    //const content = thread.content as unknown as ThreadCreationContent;

    console.log('response', thread);

    // await super.createThread({
    //   initialComment: {
    //     body: content.initialComment.body,
    //     metadata: content.initialComment.metadata,
    //   },
    //   metadata: content.metadata,
    // });

    const threadData: ThreadData = threadApiToThreadData(thread);

    this.threadsYMap.set(thread.id, threadToYMap(threadData));
    void this.refreshThreadsFromServer();

    return threadData;
  };

  public getThread(threadId: string) {
    console.log('getThread', threadId);

    const yThread = this.threadsYMap.get(threadId);
    if (!yThread) {
      throw new Error('Thread not found');
    }
    const thread = yMapToThread(yThread);
    return thread;
  }

  public getThreads(): Map<string, ThreadData> {
    return this.threads;
  }

  // Optional helper to refresh threads from the server and populate the Yjs map.
  public async refreshThreadsFromServer(): Promise<void> {
    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new APIError(
        'Failed to get threads in document',
        await errorCauses(response),
      );
    }

    const threads = (await response.json()) as CommentThreadApiListResponse;
    threads.results.forEach((thread) => {
      const threadData: ThreadData = threadApiToThreadData(thread);
      //this.threadsYMap.set(thread.id, threadToYMap(threadData));
      this.threads.set(thread.id, threadData);
    });
  }

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

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        ...body,
      }),
    });

    console.log('addComment');
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

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
      method: 'PUT',
      body: JSON.stringify({
        ...body,
      }),
    });

    console.log('updateComment');
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

    console.log('deleteComment');
    console.log('threadId', threadId);
    console.log('commentId', commentId);
    console.log('softDelete', body);

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
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
    console.log('deleteThread');
    console.log('threadId', _options.threadId);

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
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
    console.log('resolveThread');
    console.log('threadId', _options.threadId);

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
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
    console.log('unresolveThread');
    console.log('threadId', _options.threadId);

    const response = await fetchAPI(`documents/${this.docId}/comments/`, {
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
    console.log('addReaction');
    console.log('threadId', options.threadId);
    console.log('commentId', options.commentId);
    console.log('emoji', options.emoji);

    const { ...body } = options;
    const response = await fetchAPI(
      `documents/${this.docId}/comments/reactions`,
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
    console.log('deleteReaction');
    console.log('threadId', options.threadId);
    console.log('commentId', options.commentId);
    console.log('emoji', options.emoji);

    const response = await fetchAPI(
      `documents/${this.docId}/comments/reactions/${options.emoji}`,
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

const threadApiToThreadData = (
  threadApi: CommentThreadApiResponse,
): ThreadData => {
  return {
    type: 'thread',
    id: threadApi.id,
    /**
     * The date when the thread was created.
     */
    createdAt: new Date(threadApi.created_at),
    /**
     * The date when the thread was last updated.
     */
    updatedAt: new Date(threadApi.updated_at),
    comments: [
      {
        type: 'comment',
        id: threadApi.id + '-c1',
        userId: String(threadApi.user.id),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        body: threadApi.content.initialComment.body,
        createdAt: new Date(threadApi.created_at),
        updatedAt: new Date(threadApi.updated_at),
        reactions: [],
        metadata: null,
      },
    ],
    resolved: false,
    metadata: null,
  };
};
