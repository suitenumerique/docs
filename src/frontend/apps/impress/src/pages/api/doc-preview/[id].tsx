import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';
import { ImageResponse } from 'next/og';

import { previewTitle } from '@/docs/doc-meta/previewTitle';
import { getPublicDoc, getPublicHostname } from '@/docs/doc-meta/server';

const range = (from: number, to: number) =>
  `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`;

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

// Latin first: the other two only draw what Geist lacks
const FONTS = [
  ['Geist', 'Geist-Regular.ttf'],
  ['Noto Sans Hebrew', 'NotoSansHebrew-Regular.ttf'],
  ['Vazirmatn', 'Vazirmatn-Regular.ttf'],
];
const FONT_DIR = path.join(process.cwd(), 'public/assets/fonts/preview');

type Font = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' };
let fonts: Promise<Font[]> | undefined;

const loadFonts = () => {
  fonts ??= Promise.all(
    FONTS.map(async ([name, file]) => {
      const data = await readFile(path.join(FONT_DIR, file));
      return {
        name,
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
        weight: 400 as const,
        style: 'normal' as const,
      };
    }),
  ).catch((error: unknown) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
};

// Rendering blocks the event loop for a few hundred milliseconds: render each
// card once per CACHE_TTL, whatever the query string
const cache = new Map<string, { png: Buffer; expires: number }>();

const shortTitle = (title: string) => {
  const text = title.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_TITLE_LENGTH) {
    return text;
  }

  const cut = text.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');

  return `${lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
};

const renderCard = async (title: string, host: string) => {
  // `null` when the fonts can't draw it: the card goes without the title
  const laidOut = previewTitle(title);
  const fontSize = title.length > 40 ? 56 : 72;

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
          flexDirection: laidOut?.rtl ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          columnGap: Math.round(fontSize * 0.28),
          fontSize,
          lineHeight: 1.2,
          wordBreak: 'break-word',
        }}
      >
        {laidOut?.words.map((word, index) => (
          <span key={index}>{word}</span>
        ))}
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
    { width: 1200, height: 630, fonts: await loadFonts() },
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

  const title = shortTitle(doc.title || '');
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
