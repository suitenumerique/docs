import { describe, expect, it } from 'vitest';

import { isSameOriginUrl, matchEmbedOrigin } from '../EmbedBlock';

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

    it('returns true for an unparsable URL (treated as unsafe)', () => {
      expect(isSameOriginUrl('not a valid url %%')).toBe(true);
    });
  });

  describe('matchEmbedOrigin', () => {
    it('returns the sandbox for an exact host match', () => {
      expect(
        matchEmbedOrigin('https://example.com/page', {
          'example.com': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });

    it('returns undefined when the host is not in the allowlist', () => {
      expect(
        matchEmbedOrigin('https://example.com/', {
          'other.com': 'allow-scripts',
        }),
      ).toBeUndefined();
    });

    it('matches a wildcard entry for a subdomain', () => {
      expect(
        matchEmbedOrigin('https://docs.numerique.gouv.fr/', {
          '*.numerique.gouv.fr': 'allow-scripts allow-same-origin',
        }),
      ).toBe('allow-scripts allow-same-origin');
    });

    it('does not match the bare base host with a wildcard entry', () => {
      expect(
        matchEmbedOrigin('https://numerique.gouv.fr/', {
          '*.numerique.gouv.fr': 'allow-scripts',
        }),
      ).toBeUndefined();
    });

    it('prefers an exact host match over a wildcard match', () => {
      expect(
        matchEmbedOrigin('https://grist.numerique.gouv.fr/', {
          '*.numerique.gouv.fr': 'allow-scripts',
          'grist.numerique.gouv.fr': 'allow-scripts allow-forms',
        }),
      ).toBe('allow-scripts allow-forms');
    });

    it('prefers the longest wildcard match when multiple wildcards match', () => {
      expect(
        matchEmbedOrigin('https://a.b.example.com/', {
          '*.example.com': 'sandbox-a',
          '*.b.example.com': 'sandbox-b',
        }),
      ).toBe('sandbox-b');
    });

    it('matches the catch-all "*" entry when no other entry matches', () => {
      expect(
        matchEmbedOrigin('https://anything.example.com/', {
          '*': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });

    it('prefers any specific match over the catch-all "*"', () => {
      expect(
        matchEmbedOrigin('https://example.com/', {
          '*': 'allow-scripts',
          'example.com': 'allow-scripts allow-forms',
        }),
      ).toBe('allow-scripts allow-forms');
    });

    it('accepts origin entries written as full URLs and extracts the hostname', () => {
      expect(
        matchEmbedOrigin('https://example.com/page', {
          'https://example.com/': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });

    it('returns undefined for an unparsable URL', () => {
      expect(
        matchEmbedOrigin('not a valid url %%', {
          'example.com': 'allow-scripts',
        }),
      ).toBeUndefined();
    });

    it('returns undefined for an empty allowlist', () => {
      expect(matchEmbedOrigin('https://example.com/', {})).toBeUndefined();
    });

    it('does NOT match an exact host entry when the URL has a different port', () => {
      expect(
        matchEmbedOrigin('https://example.com:8080/page', {
          'example.com': 'allow-scripts',
        }),
      ).toBeUndefined();
    });

    it('matches an exact host entry when the allowlist entry includes the same port', () => {
      expect(
        matchEmbedOrigin('https://example.com:8080/page', {
          'example.com:8080': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });

    it('does NOT match a wildcard entry when the URL has a different port', () => {
      expect(
        matchEmbedOrigin('https://sub.example.com:8443/', {
          '*.example.com': 'allow-scripts',
        }),
      ).toBeUndefined();
    });

    it('matches a wildcard entry that includes the same port', () => {
      expect(
        matchEmbedOrigin('https://sub.example.com:8443/', {
          '*.example.com:8443': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });

    it('matches the catch-all "*" entry for a URL with a non-standard port', () => {
      expect(
        matchEmbedOrigin('https://example.com:3000/', { '*': 'allow-scripts' }),
      ).toBe('allow-scripts');
    });

    it('allows any https URL and returns the default sandbox', () => {
      expect(
        matchEmbedOrigin('https://example.com/', {
          '*': 'allow-scripts',
        }),
      ).toBe('allow-scripts');
    });
  });
});
