import type { Mark } from '@tiptap/pm/model';

/**
 * Name of the ProseMirror mark BlockNote uses to attach a comment thread to a
 * range of content (see `@blocknote/core` `CommentMark`). The mark carries the
 * thread id and whether it is "orphan" (its thread has been resolved).
 */
export const COMMENT_MARK_NAME = 'comment';

/**
 * Name of the prop (and therefore the ProseMirror node attribute) that mirrors
 * the comment marks of a content-less inline node, such as a doc link or a user
 * mention.
 *
 * y-prosemirror only stores the *attributes* of such nodes in Yjs, never their
 * marks. A BlockNote comment is a `comment` mark, so a comment added on one of
 * these nodes only lives in the local editor state: it disappears on reload and
 * never reaches other collaborators (#2807, #2878). Persisting the marks here,
 * as an attribute, is what lets `InlineNodeCommentsExtension` restore them.
 */
export const INLINE_NODE_COMMENTS_PROP = 'commentMarks';

export interface CommentMarkData {
  threadId: string;
  orphan: boolean;
}

const byThreadId = (a: CommentMarkData, b: CommentMarkData): number =>
  a.threadId.localeCompare(b.threadId);

/**
 * Extract the comment marks of a node as plain, sorted data. Marks without a
 * thread id (not yet attached to a thread) are ignored.
 */
export const extractCommentMarks = (
  marks: readonly Mark[],
): CommentMarkData[] =>
  marks
    .filter(
      (mark) =>
        mark.type.name === COMMENT_MARK_NAME &&
        typeof mark.attrs.threadId === 'string' &&
        mark.attrs.threadId !== '',
    )
    .map((mark) => ({
      threadId: mark.attrs.threadId as string,
      orphan: mark.attrs.orphan === true,
    }))
    .sort(byThreadId);

/**
 * Serialize comment mark data to the string stored in the node attribute. An
 * empty set is stored as the empty string so it matches the prop default and no
 * attribute is written to the DOM / Yjs.
 */
export const stringifyCommentMarks = (
  data: readonly CommentMarkData[],
): string => (data.length === 0 ? '' : JSON.stringify([...data].sort(byThreadId)));

/**
 * Parse the node attribute back into comment mark data. Never throws: an
 * unexpected or corrupted value is treated as "no comments".
 */
export const parseCommentMarks = (value: unknown): CommentMarkData[] => {
  if (typeof value !== 'string' || value === '') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (entry): entry is CommentMarkData =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as Partial<CommentMarkData>).threadId === 'string' &&
          (entry as CommentMarkData).threadId !== '',
      )
      .map((entry) => ({
        threadId: entry.threadId,
        orphan: entry.orphan === true,
      }))
      .sort(byThreadId);
  } catch {
    return [];
  }
};

/** Whether two sets of comment mark data describe the same comments. */
export const commentMarksEqual = (
  a: readonly CommentMarkData[],
  b: readonly CommentMarkData[],
): boolean =>
  a.length === b.length &&
  a.every(
    (entry, index) =>
      entry.threadId === b[index].threadId && entry.orphan === b[index].orphan,
  );
