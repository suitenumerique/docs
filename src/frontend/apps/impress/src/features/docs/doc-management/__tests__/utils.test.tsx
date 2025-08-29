import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { LinkReach, LinkRole, Role } from '../types';
import {
  base64ToBlocknoteXmlFragment,
  base64ToYDoc,
  currentDocRole,
  getDocLinkReach,
  getDocLinkRole,
  getEmojiAndTitle,
} from '../utils';

// Mock Y.js
vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    getXmlFragment: vi.fn().mockReturnValue('mocked-xml-fragment'),
  })),
  applyUpdate: vi.fn(),
}));

describe('doc-management utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('currentDocRole', () => {
    it('should return OWNER when destroy ability is true', () => {
      const abilities = {
        destroy: true,
        accesses_manage: false,
        partial_update: false,
      } as any;

      const result = currentDocRole(abilities);

      expect(result).toBe(Role.OWNER);
    });

    it('should return ADMIN when accesses_manage ability is true and destroy is false', () => {
      const abilities = {
        destroy: false,
        accesses_manage: true,
        partial_update: false,
      } as any;

      const result = currentDocRole(abilities);

      expect(result).toBe(Role.ADMIN);
    });

    it('should return EDITOR when partial_update ability is true and higher abilities are false', () => {
      const abilities = {
        destroy: false,
        accesses_manage: false,
        partial_update: true,
      } as any;

      const result = currentDocRole(abilities);

      expect(result).toBe(Role.EDITOR);
    });

    it('should return READER when no higher abilities are true', () => {
      const abilities = {
        destroy: false,
        accesses_manage: false,
        partial_update: false,
      } as any;

      const result = currentDocRole(abilities);

      expect(result).toBe(Role.READER);
    });
  });

  describe('base64ToYDoc', () => {
    it('should convert base64 string to Y.Doc', () => {
      const base64String = 'dGVzdA=='; // "test" in base64
      const mockYDoc = { getXmlFragment: vi.fn() };

      (Y.Doc as any).mockReturnValue(mockYDoc);

      const result = base64ToYDoc(base64String);

      expect(Y.Doc).toHaveBeenCalled();
      expect(Y.applyUpdate).toHaveBeenCalledWith(mockYDoc, expect.any(Buffer));
      expect(result).toBe(mockYDoc);
    });

    it('should handle empty base64 string', () => {
      const base64String = '';
      const mockYDoc = { getXmlFragment: vi.fn() };

      (Y.Doc as any).mockReturnValue(mockYDoc);

      const result = base64ToYDoc(base64String);

      expect(Y.Doc).toHaveBeenCalled();
      expect(Y.applyUpdate).toHaveBeenCalledWith(mockYDoc, expect.any(Buffer));
      expect(result).toBe(mockYDoc);
    });
  });

  describe('base64ToBlocknoteXmlFragment', () => {
    it('should convert base64 to Blocknote XML fragment', () => {
      const base64String = 'dGVzdA==';
      const mockYDoc = {
        getXmlFragment: vi.fn().mockReturnValue('mocked-xml-fragment'),
      };

      (Y.Doc as any).mockReturnValue(mockYDoc);

      const result = base64ToBlocknoteXmlFragment(base64String);

      expect(Y.Doc).toHaveBeenCalled();
      expect(Y.applyUpdate).toHaveBeenCalledWith(mockYDoc, expect.any(Buffer));
      expect(mockYDoc.getXmlFragment).toHaveBeenCalledWith('document-store');
      expect(result).toBe('mocked-xml-fragment');
    });
  });

  describe('getDocLinkReach', () => {
    it('should return computed_link_reach when available', () => {
      const doc = {
        computed_link_reach: LinkReach.PUBLIC,
        link_reach: LinkReach.RESTRICTED,
      } as any;

      const result = getDocLinkReach(doc);

      expect(result).toBe(LinkReach.PUBLIC);
    });

    it('should fallback to link_reach when computed_link_reach is not available', () => {
      const doc = {
        link_reach: LinkReach.AUTHENTICATED,
      } as any;

      const result = getDocLinkReach(doc);

      expect(result).toBe(LinkReach.AUTHENTICATED);
    });

    it('should handle undefined computed_link_reach', () => {
      const doc = {
        computed_link_reach: undefined,
        link_reach: LinkReach.RESTRICTED,
      } as any;

      const result = getDocLinkReach(doc);

      expect(result).toBe(LinkReach.RESTRICTED);
    });
  });

  describe('getDocLinkRole', () => {
    it('should return computed_link_role when available', () => {
      const doc = {
        computed_link_role: LinkRole.EDITOR,
        link_role: LinkRole.READER,
      } as any;

      const result = getDocLinkRole(doc);

      expect(result).toBe(LinkRole.EDITOR);
    });

    it('should fallback to link_role when computed_link_role is not available', () => {
      const doc = {
        link_role: LinkRole.READER,
      } as any;

      const result = getDocLinkRole(doc);

      expect(result).toBe(LinkRole.READER);
    });

    it('should handle undefined computed_link_role', () => {
      const doc = {
        computed_link_role: undefined,
        link_role: LinkRole.EDITOR,
      } as any;

      const result = getDocLinkRole(doc);

      expect(result).toBe(LinkRole.EDITOR);
    });
  });

  describe('getEmojiAndTitle', () => {
    it('should extract emoji and title when emoji is present at the beginning', () => {
      const title = '🚀 My Awesome Document';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBe('🚀');
      expect(result.titleWithoutEmoji).toBe('My Awesome Document');
    });

    it('should handle complex emojis with modifiers', () => {
      const title = '👨‍💻 Developer Notes';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBe('👨‍💻');
      expect(result.titleWithoutEmoji).toBe('Developer Notes');
    });

    it('should handle emojis with skin tone modifiers', () => {
      const title = '👍 Great Work!';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBe('👍');
      expect(result.titleWithoutEmoji).toBe('Great Work!');
    });

    it('should return null emoji and full title when no emoji is present', () => {
      const title = 'Document Without Emoji';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBeNull();
      expect(result.titleWithoutEmoji).toBe('Document Without Emoji');
    });

    it('should handle empty title', () => {
      const title = '';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBeNull();
      expect(result.titleWithoutEmoji).toBe('');
    });

    it('should handle title with only emoji', () => {
      const title = '📝';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBe('📝');
      expect(result.titleWithoutEmoji).toBe('');
    });

    it('should handle title with emoji in the middle (should not extract)', () => {
      const title = 'My 📝 Document';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBeNull();
      expect(result.titleWithoutEmoji).toBe('My 📝 Document');
    });

    it('should handle title with multiple emojis at the beginning', () => {
      const title = '🚀📚 Project Documentation';

      const result = getEmojiAndTitle(title);

      expect(result.emoji).toBe('🚀');
      expect(result.titleWithoutEmoji).toBe('📚 Project Documentation');
    });
  });
});
