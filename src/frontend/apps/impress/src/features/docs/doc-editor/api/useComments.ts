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
import { useMemo } from 'react';
import {
  relativePositionToAbsolutePosition as relPosToAbs,
  ySyncPluginKey,
} from 'y-prosemirror';
// (Previously used low-level helpers removed in favor of ySync plugin state)
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

import { useEditorStore } from '../stores';

interface CommentThreadAbilities {
  destroy: boolean;
  update: boolean;
  partial_update: boolean;
  retrieve: boolean;
}

interface CommentThreadApiResponse {
  id: string;
  content: JSON;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  user: User;
  document: string; // Document UUID
  abilities: CommentThreadAbilities;
}

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
  constructor(
    protected docId: Doc['id'],
    protected yDoc: Y.Doc,
    auth: ThreadStoreAuth,
  ) {
    super(yDoc.getMap('threads'), auth);
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
    try {
      const { editor } = useEditorStore.getState();
      if (!editor) {
        console.warn('addThreadToDocument: editor not ready');
        return Promise.resolve();
      }
      interface TiptapLikeView {
        state: {
          schema: { marks: Record<string, any> };
          tr: { addMark: (from: number, to: number, mark: any) => any };
        };
        dispatch: (tr: any) => void;
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
      const markType = view.state.schema.marks['comment'];
      if (!markType) {
        console.warn('addThreadToDocument: comment mark type missing');
        return Promise.resolve();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    const json = (await response.json()) as CommentThreadApiResponse;
    const content = json.content as unknown as ThreadCreationContent;

    console.log('response', json);

    return {
      type: 'thread',
      id: '12456',
      /**
       * The date when the thread was created.
       */
      createdAt: new Date(json.created_at),
      /**
       * The date when the thread was last updated.
       */
      updatedAt: new Date(json.updated_at),
      /**
       * The comments in the thread.
       */
      comments: [
        {
          id: json.id,
          body: content.initialComment.body,
          createdAt: new Date(json.created_at),
          updatedAt: new Date(json.updated_at),
          metadata: null,
        },
      ],
      /**
       * Whether the thread has been marked as resolved.
       */
      resolved: false,
      metadata: null,
    } as ThreadData;
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

// Legacy helper removed: direct mark application now uses existing editor view & ySync mapping.

// Removed unused setMarkInProsemirror helper (handled directly via editor.view.tr.addMark)
