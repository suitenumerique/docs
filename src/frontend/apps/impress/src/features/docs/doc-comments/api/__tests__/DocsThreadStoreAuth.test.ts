import { describe, expect, it } from 'vitest';

import { ClientCommentData } from '../../types';
import { DocsThreadStoreAuth } from '../DocsThreadStoreAuth';

const makeComment = (
  reactions: { emoji: string; userIds: string[] }[],
): ClientCommentData =>
  ({
    reactions,
    metadata: { abilities: { reactions: true } },
  }) as unknown as ClientCommentData;

describe('DocsThreadStoreAuth reactions', () => {
  const auth = new DocsThreadStoreAuth('me', true, 10);
  // The emoji picker sends the thumbs up with a variation selector, the
  // reactions are stored without it.
  const picked = '\u{1F44D}️';
  const stored = '\u{1F44D}';

  it('does not add an emoji already reacted to by the user', () => {
    const comment = makeComment([{ emoji: stored, userIds: ['me'] }]);

    expect(auth.canAddReaction(comment, picked)).toBe(false);
    expect(auth.canDeleteReaction(comment, picked)).toBe(true);
  });

  it('adds an emoji reacted to by another user', () => {
    const comment = makeComment([{ emoji: stored, userIds: ['other'] }]);

    expect(auth.canAddReaction(comment, picked)).toBe(true);
    expect(auth.canDeleteReaction(comment, picked)).toBe(false);
  });
});
