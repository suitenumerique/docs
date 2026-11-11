import type { NextApiRequest, NextApiResponse } from 'next';
import { ImageResponse } from 'next/og';

import { getPublicDoc, getPublicHostname } from '@/docs/doc-meta/server';

const range = (from: number, to: number) =>
  `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`;

// Characters the bundled font has: Latin, Latin-1, Latin Extended-A, dashes,
// quotes and the ellipsis. For any other one, next/og would fetch a font or an
// emoji image from the internet, and the renderer has no right-to-left
// layout: leave out the title rather than draw it wrong or wait on a CDN.
const SUPPORTED_TITLE = new RegExp(
  `^[${range(0x20, 0x7e)}${range(0xa0, 0x17f)}${range(0x2013, 0x2014)}${range(
    0x2018,
    0x201d,
  )}${String.fromCodePoint(0x2026)}]*$`,
);
// Docs stores the doc icon as an emoji at the start of the title. Pictographs
// (but the © and ® the font has), joiners, variation selectors, flag letters,
// skin tones, keycaps and tag characters.
const EMOJI = new RegExp(
  `(?![${String.fromCodePoint(0xa9)}${String.fromCodePoint(0xae)}])\\p{Extended_Pictographic}|[${range(0xfe00, 0xfe0f)}${String.fromCodePoint(0x200d)}${String.fromCodePoint(0x20e3)}${range(0x1f1e6, 0x1f1ff)}${range(0x1f3fb, 0x1f3ff)}${range(0xe0020, 0xe007f)}]`,
  'gu',
);

const MAX_TITLE_LENGTH = 90;
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_SIZE = 200;

// Rendering blocks the event loop for a few hundred milliseconds: render each
// card once per CACHE_TTL, whatever the query string
const cache = new Map<string, { png: Buffer; expires: number }>();

const cardTitle = (title: string) => {
  const text = title.replace(EMOJI, '').trim();
  if (!SUPPORTED_TITLE.test(text)) {
    return '';
  }
  if (text.length <= MAX_TITLE_LENGTH) {
    return text;
  }

  const cut = text.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');

  return `${lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
};

const renderCard = async (title: string, host: string) => {
  const image = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: '#ffffff',
        color: '#1f2937',
        borderBottom: '16px solid #3e5de7',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 40 ? 56 : 72,
          lineHeight: 1.2,
          wordBreak: 'break-word',
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 36,
          color: '#6b7280',
        }}
      >
        <span>Docs</span>
        <span>{host}</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );

  return Buffer.from(await image.arrayBuffer());
};

/**
 * Preview image of a public doc, served at `/docs/<id>/preview.png` (see the
 * rewrite in next.config.js) for link previews.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = req.query.id;
  const doc = typeof id === 'string' ? await getPublicDoc(req, id) : null;
  if (!doc) {
    res.status(404).end();
    return;
  }

  const title = cardTitle(doc.title || '');
  // Normalized, so host variants the backend accepts share one cache entry
  const host = getPublicHostname(req);
  const key = `${host} ${doc.id} ${title}`;

  const cached = cache.get(key);
  let png = cached && cached.expires > Date.now() ? cached.png : undefined;
  if (!png) {
    try {
      png = await renderCard(title, host);
    } catch {
      res.status(500).end();
      return;
    }
    cache.delete(key);
    if (cache.size >= CACHE_SIZE) {
      cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { png, expires: Date.now() + CACHE_TTL });
  }

  res.setHeader('Content-Type', 'image/png');
  // Short-lived: the title can change and the doc can stop being public
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(png);
}
