import { describe, expect, it } from 'vitest';

import {
  CommentMarkData,
  commentMarksEqual,
  extractCommentMarks,
  parseCommentMarks,
  stringifyCommentMarks,
} from '../inlineNodeComments';

/**
 * Minimal stand-in for a ProseMirror mark, matching the shape
 * `extractCommentMarks` relies on.
 */
const mark = (name: string, attrs: Record<string, unknown>) =>
  ({ type: { name }, attrs }) as unknown as Parameters<
    typeof extractCommentMarks
  >[0][number];

describe('extractCommentMarks', () => {
  it('keeps only comment marks that carry a thread id, sorted', () => {
    const marks = [
      mark('bold', {}),
      mark('comment', { threadId: 'b', orphan: true }),
      mark('comment', { threadId: 'a', orphan: false }),
      mark('comment', { threadId: '' }), // not attached to a thread yet
    ];

    expect(extractCommentMarks(marks)).toEqual([
      { threadId: 'a', orphan: false },
      { threadId: 'b', orphan: true },
    ]);
  });

  it('returns an empty array when there is no comment', () => {
    expect(extractCommentMarks([mark('italic', {})])).toEqual([]);
  });
});

describe('stringifyCommentMarks / parseCommentMarks', () => {
  it('stores an empty set as the empty string', () => {
    expect(stringifyCommentMarks([])).toBe('');
    expect(parseCommentMarks('')).toEqual([]);
  });

  it('round-trips comment data independently of order', () => {
    const data: CommentMarkData[] = [
      { threadId: 'z', orphan: false },
      { threadId: 'a', orphan: true },
    ];

    const serialized = stringifyCommentMarks(data);

    expect(parseCommentMarks(serialized)).toEqual([
      { threadId: 'a', orphan: true },
      { threadId: 'z', orphan: false },
    ]);
  });

  it('is resilient to corrupted or unexpected values', () => {
    expect(parseCommentMarks('not json')).toEqual([]);
    expect(parseCommentMarks('{"threadId":"a"}')).toEqual([]); // not an array
    expect(parseCommentMarks('[{"orphan":true}]')).toEqual([]); // no thread id
    expect(parseCommentMarks(undefined)).toEqual([]);
    expect(parseCommentMarks(42)).toEqual([]);
  });

  it('defaults a missing orphan flag to false', () => {
    expect(parseCommentMarks('[{"threadId":"a"}]')).toEqual([
      { threadId: 'a', orphan: false },
    ]);
  });

  it('only treats a boolean true as orphan', () => {
    // A stray truthy value (e.g. the string "false") must not flip an active
    // comment to orphaned.
    expect(parseCommentMarks('[{"threadId":"a","orphan":"false"}]')).toEqual([
      { threadId: 'a', orphan: false },
    ]);
    expect(parseCommentMarks('[{"threadId":"a","orphan":1}]')).toEqual([
      { threadId: 'a', orphan: false },
    ]);
    expect(parseCommentMarks('[{"threadId":"a","orphan":true}]')).toEqual([
      { threadId: 'a', orphan: true },
    ]);
  });
});

describe('commentMarksEqual', () => {
  it('ignores ordering differences once normalized', () => {
    const a = extractCommentMarks([
      mark('comment', { threadId: 'b', orphan: false }),
      mark('comment', { threadId: 'a', orphan: false }),
    ]);
    const b = parseCommentMarks(
      stringifyCommentMarks([
        { threadId: 'a', orphan: false },
        { threadId: 'b', orphan: false },
      ]),
    );

    expect(commentMarksEqual(a, b)).toBe(true);
  });

  it('detects a changed orphan flag', () => {
    expect(
      commentMarksEqual(
        [{ threadId: 'a', orphan: false }],
        [{ threadId: 'a', orphan: true }],
      ),
    ).toBe(false);
  });

  it('detects an added comment', () => {
    expect(
      commentMarksEqual(
        [{ threadId: 'a', orphan: false }],
        [
          { threadId: 'a', orphan: false },
          { threadId: 'b', orphan: false },
        ],
      ),
    ).toBe(false);
  });
});
