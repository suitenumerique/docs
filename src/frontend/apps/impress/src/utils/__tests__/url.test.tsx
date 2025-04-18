import { isSafeUrl } from '@/utils/url';

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
