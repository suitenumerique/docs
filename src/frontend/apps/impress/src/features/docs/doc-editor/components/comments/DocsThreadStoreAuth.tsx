import { ThreadStoreAuth } from '@blocknote/core/comments';

import { ClientCommentData, ClientThreadData } from './types';

export class DocsThreadStoreAuth extends ThreadStoreAuth {
  constructor(
    private readonly userId: string,
    public canSee: boolean,
    private readonly maxReactions: number = 10,
  ) {
    super();
  }

  canCreateThread(): boolean {
    return true;
  }

  canAddComment(_thread: ClientThreadData): boolean {
    return true;
  }

  canUpdateComment(comment: ClientCommentData): boolean {
    if (
      comment.metadata.abilities.partial_update &&
      comment.userId === this.userId
    ) {
      return true;
    }

    return false;
  }

  canDeleteComment(comment: ClientCommentData): boolean {
    if (comment.metadata.abilities.destroy) {
      return true;
    }

    return false;
  }

  canDeleteThread(thread: ClientThreadData): boolean {
    if (thread.metadata.abilities.destroy) {
      return true;
    }

    return false;
  }

  canResolveThread(thread: ClientThreadData): boolean {
    if (thread.metadata.abilities.resolve) {
      return true;
    }

    return false;
  }

  /**
   * Not implemented backend side
   * @param _thread
   * @returns
   */
  canUnresolveThread(_thread: ClientThreadData): boolean {
    return false;
  }

  canAddReaction(comment: ClientCommentData, emoji?: string): boolean {
    if (!comment.metadata.abilities.reactions) {
      return false;
    }

    if (!emoji) {
      return comment.reactions.length < this.maxReactions;
    }

    const hasReactedWithEmoji = comment.reactions.some(
      (reaction) =>
        reaction.emoji === emoji && reaction.userIds.includes(this.userId),
    );

    if (hasReactedWithEmoji) {
      return false;
    }

    const reactionExists = comment.reactions.some(
      (reaction) => reaction.emoji === emoji,
    );

    if (reactionExists) {
      return true;
    }

    return comment.reactions.length < this.maxReactions;
  }

  canDeleteReaction(comment: ClientCommentData, emoji?: string): boolean {
    if (!comment.metadata.abilities.reactions) {
      return false;
    }

    if (!emoji) {
      return true;
    }

    return comment.reactions.some(
      (reaction) =>
        reaction.emoji === emoji && reaction.userIds.includes(this.userId),
    );
  }
}
