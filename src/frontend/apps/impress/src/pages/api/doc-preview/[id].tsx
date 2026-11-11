import type { NextApiRequest, NextApiResponse } from 'next';
import { ImageResponse } from 'next/og';

import { getPublicDoc, getPublicHost } from '@/docs/doc-meta/server';

// The bundled font is Latin only and the renderer lays text out left to right:
// leave out titles it would draw as boxes or backwards
const SUPPORTED_TITLE =
  /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;

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

  const title = doc.title && SUPPORTED_TITLE.test(doc.title) ? doc.title : '';

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
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.2,
          lineClamp: 3,
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
        <span>{getPublicHost(req)}</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );

  res.setHeader('Content-Type', 'image/png');
  // Short-lived: the title can change and the doc can stop being public
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(Buffer.from(await image.arrayBuffer()));
}
