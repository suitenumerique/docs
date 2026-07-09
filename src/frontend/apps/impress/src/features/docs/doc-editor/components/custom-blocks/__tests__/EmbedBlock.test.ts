import { describe, expect, it } from 'vitest';

import { isSameOriginUrl } from '../EmbedBlock';

describe('EmbedBlock', () => {
  describe('isSameOriginUrl', () => {
    it('returns true for a URL with the same origin as the app', () => {
      expect(isSameOriginUrl(window.location.origin + '/some/path')).toBe(true);
    });

    it('returns true for a relative URL (resolves to same origin)', () => {
      expect(isSameOriginUrl('/relative/path')).toBe(true);
    });

    it('returns false for a cross-origin https URL', () => {
      expect(isSameOriginUrl('https://example.com/page')).toBe(false);
    });

    it('returns false for a cross-origin URL with a different subdomain', () => {
      expect(isSameOriginUrl('https://sub.example.com/')).toBe(false);
    });

    it('returns false for a cross-origin URL on a different port', () => {
      expect(isSameOriginUrl('https://localhost:9999/')).toBe(false);
    });

    it('returns true for an unparseable URL (treated as unsafe)', () => {
      expect(isSameOriginUrl('not a valid url %%')).toBe(true);
    });
  });
});
