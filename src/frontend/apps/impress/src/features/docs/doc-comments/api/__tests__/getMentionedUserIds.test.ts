import { describe, expect, it } from 'vitest';

import { getMentionedUserIds } from '../getMentionedUserIds';

const mention = (userId: string) => ({
  type: 'userMentionInline',
  props: { userId, fullName: `User ${userId}` },
});

describe('getMentionedUserIds', () => {
  it('returns the users mentioned in the blocks and their children, once', () => {
    const body = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ', styles: {} },
          mention('user-1'),
          { type: 'interlinkingLinkInline', props: { docId: 'doc-1' } },
        ],
        children: [{ type: 'paragraph', content: [mention('user-2')] }],
      },
      { type: 'paragraph', content: [mention('user-1')] },
    ];

    expect(getMentionedUserIds(body)).toEqual(['user-1', 'user-2']);
  });

  it('returns nothing for a comment without mention', () => {
    expect(
      getMentionedUserIds([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: {} }],
        },
      ]),
    ).toEqual([]);
  });

  it.each([undefined, null, {}, { type: 'doc', content: [] }, 'text'])(
    'ignores a body which is not a list of blocks: %s',
    (body) => {
      expect(getMentionedUserIds(body)).toEqual([]);
    },
  );

  it('ignores a mention without user', () => {
    expect(
      getMentionedUserIds([
        {
          type: 'paragraph',
          content: [{ type: 'userMentionInline', props: { userId: '' } }],
        },
      ]),
    ).toEqual([]);
  });
});
