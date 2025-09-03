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
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { EditorState, TextSelection } from 'prosemirror-state';
import { useMemo } from 'react';
import {
  initProseMirrorDoc,
  relativePositionToAbsolutePosition,
  updateYFragment,
} from 'y-prosemirror';
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

import { blockNoteSchema } from '../components/BlockNoteEditor';
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
    console.log('addThreadToDocument');

    const { threadId, selection } = options;

    setMark(
      this.yDoc,
      this.yDoc.getXmlFragment('document-store'),
      selection.yjs,
      'comment',
      {
        orphan: false,
        threadId: threadId,
      },
    );

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

function setMark(
  doc: Y.Doc,
  fragment: Y.XmlFragment,
  yjsSelection: {
    anchor: any;
    head: any;
  },
  markName: string,
  markAttributes: any,
) {
  // needed to get the pmSchema
  // if you use a BlockNote custom schema, make sure to pass it to the create options
  //const editor = ServerBlockNoteEditor.create();
  const { editor } = useEditorStore.getState();

  console.log('editor', editor);

  const pmSchema = editor!.pmSchema;

  // get the prosemirror document
  const { doc: pNode, mapping } = initProseMirrorDoc(fragment, pmSchema as any);

  // get the prosemirror positions based on the yjs positions
  // we need to get this from yjs because other users might have made changes in between
  const anchor = relativePositionToAbsolutePosition(
    doc,
    fragment,
    yjsSelection.anchor,
    mapping,
  );
  const head = relativePositionToAbsolutePosition(
    doc,
    fragment,
    yjsSelection.head,
    mapping,
  );

  // now, let's create the mark in the prosemirror document
  const state = EditorState.create({
    doc: pNode,
    schema: pmSchema as any,
    selection: TextSelection.create(pNode, anchor!, head!),
  });

  const tr = setMarkInProsemirror(
    pmSchema.marks[markName],
    markAttributes,
    state,
  );

  // finally, update the yjs document with the new prosemirror document
  updateYFragment(doc, fragment, tr.doc, mapping);
}

export const setMarkInProsemirror = (
  type: any,
  attributes = {},
  state: EditorState,
) => {
  let tr = state.tr;
  const { selection } = state;
  const { ranges } = selection;

  ranges.forEach((range) => {
    const from = range.$from.pos;
    const to = range.$to.pos;

    state.doc.nodesBetween(from, to, (node, pos) => {
      const trimmedFrom = Math.max(pos, from);
      const trimmedTo = Math.min(pos + node.nodeSize, to);
      const someHasMark = node.marks.find((mark) => mark.type === type);

      // if there is already a mark of this type
      // we know that we have to merge its attributes
      // otherwise we add a fresh new mark
      if (someHasMark) {
        node.marks.forEach((mark) => {
          if (type === mark.type) {
            tr = tr.addMark(
              trimmedFrom,
              trimmedTo,
              type.create({
                ...mark.attrs,
                ...attributes,
              }),
            );
          }
        });
      } else {
        tr = tr.addMark(trimmedFrom, trimmedTo, type.create(attributes));
      }
    });
  });
  return tr;
};
