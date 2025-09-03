/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommentData,
  CommentReactionData,
  ThreadData,
} from '@blocknote/core/comments';
import * as Y from 'yjs';

export function commentToYMap(comment: CommentData) {
  const yMap = new Y.Map<any>();
  yMap.set('id', comment.id);
  yMap.set('userId', comment.userId);
  yMap.set('createdAt', comment.createdAt.getTime());
  yMap.set('updatedAt', comment.updatedAt.getTime());
  if (comment.deletedAt) {
    yMap.set('deletedAt', comment.deletedAt.getTime());
    yMap.set('body', undefined);
  } else {
    yMap.set('body', comment.body);
  }
  if (comment.reactions.length > 0) {
    throw new Error('Reactions should be empty in commentToYMap');
  }

  /**
   * Reactions are stored in a map keyed by {userId-emoji},
   * this makes it easy to add / remove reactions and in a way that works local-first.
   * The cost is that "reading" the reactions is a bit more complex (see yMapToReactions).
   */
  yMap.set('reactionsByUser', new Y.Map());
  yMap.set('metadata', comment.metadata);

  return yMap;
}

export function threadToYMap(thread: ThreadData) {
  const yMap = new Y.Map();
  yMap.set('id', thread.id);
  yMap.set('createdAt', thread.createdAt.getTime());
  yMap.set('updatedAt', thread.updatedAt.getTime());
  const commentsArray = new Y.Array<Y.Map<any>>();

  commentsArray.push(thread.comments.map((comment) => commentToYMap(comment)));

  yMap.set('comments', commentsArray);
  yMap.set('resolved', thread.resolved);
  yMap.set('resolvedUpdatedAt', thread.resolvedUpdatedAt?.getTime());
  yMap.set('resolvedBy', thread.resolvedBy);
  yMap.set('metadata', thread.metadata);
  return yMap;
}

type SingleUserCommentReactionData = {
  emoji: string;
  createdAt: Date;
  userId: string;
};

export function yMapToReaction(
  yMap: Y.Map<any>,
): SingleUserCommentReactionData {
  return {
    emoji: yMap.get('emoji'),
    createdAt: new Date(yMap.get('createdAt')),
    userId: yMap.get('userId'),
  };
}

function yMapToReactions(yMap: Y.Map<any>): CommentReactionData[] {
  const flatReactions: SingleUserCommentReactionData[] = [];
  yMap.forEach((reaction: Y.Map<any>) => {
    flatReactions.push(yMapToReaction(reaction));
  });
  // combine reactions by the same emoji
  return flatReactions.reduce(
    (acc: CommentReactionData[], reaction: SingleUserCommentReactionData) => {
      const existingReaction = acc.find((r) => r.emoji === reaction.emoji);
      if (existingReaction) {
        existingReaction.userIds.push(reaction.userId);
        existingReaction.createdAt = new Date(
          Math.min(
            existingReaction.createdAt.getTime(),
            reaction.createdAt.getTime(),
          ),
        );
      } else {
        acc.push({
          emoji: reaction.emoji,
          createdAt: reaction.createdAt,
          userIds: [reaction.userId],
        });
      }
      return acc;
    },
    [] as CommentReactionData[],
  );
}

export function yMapToComment(yMap: Y.Map<any>): CommentData {
  return {
    type: 'comment',
    id: yMap.get('id'),
    userId: yMap.get('userId'),
    createdAt: new Date(yMap.get('createdAt')),
    updatedAt: new Date(yMap.get('updatedAt')),
    deletedAt: yMap.get('deletedAt')
      ? new Date(yMap.get('deletedAt'))
      : undefined,
    reactions: yMapToReactions(yMap.get('reactionsByUser')),
    metadata: yMap.get('metadata'),
    body: yMap.get('body'),
  };
}

export function yMapToThread(yMap: Y.Map<any>): ThreadData {
  return {
    type: 'thread',
    id: yMap.get('id'),
    createdAt: new Date(yMap.get('createdAt')),
    updatedAt: new Date(yMap.get('updatedAt')),
    comments: ((yMap.get('comments') as Y.Array<Y.Map<any>>) || []).map(
      (comment) => yMapToComment(comment),
    ),
    resolved: yMap.get('resolved'),
    resolvedUpdatedAt: new Date(yMap.get('resolvedUpdatedAt')),
    resolvedBy: yMap.get('resolvedBy'),
    metadata: yMap.get('metadata'),
  };
}
