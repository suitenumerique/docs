import { describe, expect, it } from 'vitest';

import {
  isDataUrl,
  isLocalDevOrigin,
  isSafeUrl,
  isSameOrigin,
} from '@/utils/url';

describe('isSafeUrl', () => {
  // XSS Attacks
  const xssUrls = [
    "javascript:alert('xss')",
    "data:text/html,<script>alert('xss')</script>",
    "vbscript:msgbox('xss')",
    "expression(alert('xss'))",
    "https://example.com/\"><script>alert('xss')</script>",
    "https://example.com/\"><img src=x onerror=alert('xss')>",
    "javascript:/*--></title></style></textarea></script><xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
  ];

  // Directory Traversal
  const traversalUrls = [
    'https://example.com/../../etc/passwd',
    'https://example.com/..%2F..%2Fetc%2Fpasswd',
    'https://example.com/..\\..\\Windows\\System32\\config\\SAM',
  ];

  // SQL Injection
  const sqlInjectionUrls = [
    "https://example.com/' OR '1'='1",
    'https://example.com/; DROP TABLE users;',
    "https://example.com/' OR 1=1 --",
  ];

  // Malicious Encodings
  const encodingUrls = [
    "https://example.com/%3Cscript%3Ealert('xss')%3C/script%3E",
    'https://example.com/%00',
    'https://example.com/\\0',
    'https://example.com/file.php%00.jpg',
  ];

  // Unauthorized Protocols
  const protocolUrls = [
    'file:///etc/passwd',
    'ftp://attacker.com/malware.exe',
    'telnet://attacker.com',
  ];

  // Long URLs
  const longUrls = ['https://example.com/' + 'a'.repeat(2001)];

  // Safe URLs
  const safeUrls = [
    'https://example.com',
    'https://example.com/path/to/file',
    'https://example.com?param=value',
    'https://example.com#section',
  ];

  describe('should block XSS attacks', () => {
    xssUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should block directory traversal', () => {
    traversalUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should block SQL injection', () => {
    sqlInjectionUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should block malicious encodings', () => {
    encodingUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should block unauthorized protocols', () => {
    protocolUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should block long URLs', () => {
    longUrls.forEach((url) => {
      it(`should block ${url}`, () => {
        expect(isSafeUrl(url)).toBe(false);
      });
    });
  });

  describe('should allow safe URLs', () => {
    safeUrls.forEach((url) => {
      it(`should allow ${url}`, () => {
        expect(isSafeUrl(url)).toBe(true);
      });
    });
  });
});

describe('isSameOrigin', () => {
  it('returns true for a relative URL', () => {
    expect(isSameOrigin('/media/image.png')).toBe(true);
  });

  it('returns true for an absolute same-origin URL', () => {
    expect(isSameOrigin(`${window.location.origin}/media/image.png`)).toBe(
      true,
    );
  });

  it('returns false for a cross-origin URL', () => {
    expect(isSameOrigin('https://example.com/image.png')).toBe(false);
  });

  it('returns false for a localhost URL on a different port', () => {
    // window.location is http://localhost:3000 in this test environment.
    // A different port is a different origin, full stop: the local-dev
    // convenience lives in isLocalDevOrigin, not here.
    expect(isSameOrigin('http://localhost:8083/media/image.png')).toBe(false);
  });

  it('returns false for a cross-origin URL that merely contains the current hostname', () => {
    expect(
      isSameOrigin(`https://example.com/?redirect=${window.location.hostname}`),
    ).toBe(false);
  });

  it('returns false for an unparsable URL', () => {
    expect(isSameOrigin('http://')).toBe(false);
  });
});

describe('isLocalDevOrigin', () => {
  it('returns true for a localhost URL on a different port, same protocol', () => {
    // window.location is http://localhost:3000 in this test environment,
    // matching a local dev setup where the frontend, API and media server
    // run on different ports of the same host.
    expect(isLocalDevOrigin('http://localhost:8083/media/image.png')).toBe(
      true,
    );
  });

  it('returns false for a localhost URL with a mismatched protocol', () => {
    // Guards against an https page silently falling back to plain http,
    // which browsers block as mixed content anyway.
    expect(isLocalDevOrigin('https://localhost:8083/media/image.png')).toBe(
      false,
    );
  });

  it('returns false for a non-localhost URL on a different port', () => {
    expect(isLocalDevOrigin('http://example.com:8083/media/image.png')).toBe(
      false,
    );
  });

  it('returns false for an unparsable URL', () => {
    expect(isLocalDevOrigin('http://')).toBe(false);
  });
});

describe('isDataUrl', () => {
  it('returns true for a data URL', () => {
    expect(isDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('returns true for a data URL with an uppercase scheme', () => {
    expect(isDataUrl('DATA:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('returns true for a data URL that is not base64 encoded', () => {
    expect(
      isDataUrl('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'),
    ).toBe(true);
  });

  it('returns false for a non-data URL', () => {
    expect(isDataUrl('https://example.com/image.png')).toBe(false);
  });

  it('returns false for an unparsable URL', () => {
    expect(isDataUrl('http://')).toBe(false);
  });
});
