import type { IncomingMessage } from 'node:http';

import { Doc, LinkReach } from '@/docs/doc-management/types';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const EXCERPT_LENGTH = 200;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
};

// One pass, so a decoded `&` never starts another reference
const CHARACTER_REFERENCE =
  /&(?:#x([0-9a-f]{1,6})|#(\d{1,7})|(amp|lt|gt|quot));/gi;

const decodeReference = (
  reference: string,
  hex?: string,
  dec?: string,
  name?: string,
) => {
  if (name) {
    return ENTITIES[name.toLowerCase()] ?? reference;
  }
  const codePoint = hex ? parseInt(hex, 16) : parseInt(dec ?? '', 10);

  return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference;
};

/**
 * GET a JSON document, `null` on any other answer. `fetch` silently drops a
 * `Host` header, so this goes through `node:http`.
 */
const getJson = async <T>(
  url: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<T | null> => {
  const { request } = url.startsWith('https:')
    ? await import('node:https')
    : await import('node:http');

  return new Promise((resolve) => {
    const req = request(url, { headers, timeout }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          resolve(null);
        }
      });
      // A body cut short (timeout, backend gone) never ends: settle anyway
      res.on('close', () => resolve(null));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
};

/**
 * Public host the visitor asked for, the first one when proxies are chained.
 */
export const getPublicHost = (req: IncomingMessage) =>
  (req.headers['x-forwarded-host'] ?? req.headers.host)
    ?.toString()
    .split(',')[0]
    .trim();

/**
 * Host name alone, as the backend matches it against ALLOWED_HOSTS: lower
 * case, without port or trailing dot.
 */
export const getPublicHostname = (req: IncomingMessage) =>
  (getPublicHost(req) ?? '')
    .toLowerCase()
    .replace(/:\d*$/, '')
    .replace(/\.$/, '');

/**
 * Public origin, to build the absolute URLs link previews need. Always https
 * but on a local machine: Next.js sets `x-forwarded-proto: http` when the
 * proxy sends none, so the header can't tell.
 */
export const getPublicOrigin = (req: IncomingMessage) => {
  const host = getPublicHost(req) ?? '';
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);

  return `${isLocal ? 'http' : 'https'}://${host}`;
};

const backendGet = <T>(req: IncomingMessage, path: string, timeout = 2000) => {
  const backendUrl = process.env.BACKEND_BASE_URL;
  if (!backendUrl) {
    return Promise.resolve(null);
  }

  // In production the backend only accepts its public host (ALLOWED_HOSTS)
  // and redirects plain http to https. Pass on the public host and always
  // claim https: Next.js sets `x-forwarded-proto: http` when the proxy sends
  // none, and these requests carry no credentials.
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Forwarded-Proto': 'https',
  };
  const host = getPublicHost(req);
  if (host) {
    headers.Host = host;
  }
  // The backend throttles by client address: count these calls against the
  // visitor, not against the frontend server they all come from
  const forwardedFor = req.headers['x-forwarded-for']?.toString();
  if (forwardedFor) {
    headers['X-Forwarded-For'] = forwardedFor;
  }

  return getJson<T>(`${backendUrl}${path}`, headers, timeout);
};

/**
 * The doc, when anyone may read it. Fetched without the visitor's cookies, so
 * a restricted or connected-only doc never leaks.
 */
export const getPublicDoc = async (req: IncomingMessage, id: string) => {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  const doc = await backendGet<Doc>(req, `/api/v1.0/documents/${id}/`);

  return doc?.computed_link_reach === LinkReach.PUBLIC ? doc : null;
};

// Headings, quotes, list items and tasks
const BLOCK_MARKER = /^\s*(#{1,6}\s+|>\s?|[*+-]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/;

// Punctuation that already ends a line, maybe inside a closing quote or bracket
const SENTENCE_END = /[.,!?:;…،؛؟۔。！？，；：।॥]["'”’»)\]}]*$/u;

// Opening code fence: a backtick fence has no backtick after it
const FENCE = /^\s*(`{3,}(?!.*`)|~{3,})/;

const TABLE_ROW = /^\s*\|/;
const QUOTE = /^\s*>\s?/;

// Words without their diacritics, which are often typed differently
const words = (text: string) =>
  (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .sort()
    .join(' ');

const sameWords = (a: string, b: string) => {
  const wordsA = words(a);

  return wordsA !== '' && wordsA === words(b);
};

const markdownLineToText = (line: string) =>
  line
    .replace(BLOCK_MARKER, '')
    // Hard line break
    .replace(/\\\s*$/, '')
    .replace(/(?<!\\)\|/g, ' ')
    // Images, then links: keep the text only
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Inline markers, then the escapes and character references the
    // markdown writer adds to plain text
    .replace(/(?<!\\)[*_~`]+/g, '')
    .replace(/\\([!-/:-@[-`{-~])/g, '$1')
    .replace(CHARACTER_REFERENCE, decodeReference)
    .trim();

/**
 * Plain text start of a markdown document, for a preview description.
 */
export const markdownToExcerpt = (markdown: string, title = '') => {
  const blocks: string[] = [];
  // The fence that opened the code block we are in
  let fence = '';
  let canContinue = false;
  let inQuote = false;

  for (const line of markdown.split('\n')) {
    // Code reads badly in a preview, and a full stop would change it
    if (fence) {
      const closing = line.trim();
      if (closing.startsWith(fence) && /^(`+|~+)$/.test(closing)) {
        fence = '';
      }
      continue;
    }
    const opening = FENCE.exec(line);
    if (opening) {
      fence = opening[1];
      canContinue = false;
      continue;
    }

    // A quote repeats its marker on each line: read what follows it
    const isQuote = QUOTE.test(line);
    const body = isQuote ? line.replace(QUOTE, '') : line;

    const text = markdownLineToText(body);
    if (!text || /^[-:\s]+$/.test(text)) {
      canContinue = false;
      continue;
    }

    // A wrapped line or a hard line break carries on the same paragraph
    const continues =
      canContinue &&
      (!isQuote || inQuote) &&
      !BLOCK_MARKER.test(body) &&
      !TABLE_ROW.test(body);
    if (continues) {
      blocks[blocks.length - 1] += ` ${text}`;
    } else {
      blocks.push(text);
    }
    canContinue = !/^\s*#{1,6}\s/.test(body) && !TABLE_ROW.test(body);
    inQuote = isQuote;
  }

  // The title is already shown above the description, often repeated as the
  // first heading, sometimes with its words in another order
  if (blocks.length && sameWords(blocks[0], title)) {
    blocks.shift();
  }

  // A heading or list item has no full stop: keep it from running into the
  // next one
  const text = blocks
    .map((block, i) =>
      i < blocks.length - 1 && !SENTENCE_END.test(block) ? `${block}.` : block,
    )
    .join(' ')
    .replace(/\s+/g, ' ');
  if (text.length <= EXCERPT_LENGTH) {
    return text;
  }

  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');

  return `${lastSpace > EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
};

/**
 * Plain text start of a public doc, `''` when it is empty or unavailable.
 */
export const getPublicDocExcerpt = async (
  req: IncomingMessage,
  doc: Pick<Doc, 'id' | 'title'>,
) => {
  // The doc is read from the collaboration server and converted: give up
  // sooner than for the doc itself, the page waits for it
  const formatted = await backendGet<{ content: string | null }>(
    req,
    `/api/v1.0/documents/${doc.id}/formatted-content/?content_format=markdown`,
    1000,
  );

  return formatted?.content
    ? markdownToExcerpt(formatted.content, doc.title)
    : '';
};
