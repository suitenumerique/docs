export function isSafeUrl(url: string): boolean {
  try {
    // Parse the URL with a base to support relative URLs
    const parsed = new URL(url, window.location.origin);

    // List of allowed protocols
    const allowedProtocols = ['http:', 'https:'];

    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    // Check for dangerous characters in the pathname
    const dangerousChars = ['<', '>', '"', "'", '(', ')', ';', '=', '{', '}'];
    if (dangerousChars.some((char) => parsed.pathname.includes(char))) {
      return false;
    }

    // Check URL length (protection against buffer overflow attacks)
    if (url.length > 2000) {
      return false;
    }

    // Check for malicious encodings
    if (url.includes('%00') || url.includes('\\0')) {
      return false;
    }

    // Check for XSS injection attempts
    const xssPatterns = [
      '<script',
      'javascript:',
      'data:',
      'vbscript:',
      'expression(',
    ];
    if (xssPatterns.some((pattern) => url.toLowerCase().includes(pattern))) {
      return false;
    }

    // Check for directory traversal attempts
    if (url.includes('..') || url.includes('../') || url.includes('..\\')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
