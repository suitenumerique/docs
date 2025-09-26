import { PartialBlock } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger } from '@/utils';

interface ErrorResponse {
  error: string;
}

const editor = ServerBlockNoteEditor.create();

export const convertHandler = async (
  req: Request<object, Uint8Array | ErrorResponse, Buffer, object>,
  res: Response<Uint8Array | string | object | ErrorResponse>,
) => {
  if (!req.body || req.body.length === 0) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  const contentType = (req.header('content-type') || 'text/markdown').split(
    ';',
  )[0];
  const accept = (req.header('accept') || 'application/vnd.yjs.doc').split(
    ';',
  )[0];

  let blocks: PartialBlock[] | null = null;
  try {
    // First, convert from the input format to blocks
    // application/x-www-form-urlencoded is interpreted as Markdown for backward compatibility
    if (
      contentType === 'text/markdown' ||
      contentType === 'application/x-www-form-urlencoded'
    ) {
      blocks = await editor.tryParseMarkdownToBlocks(req.body.toString());
    } else if (
      contentType === 'application/vnd.yjs.doc' ||
      contentType === 'application/octet-stream'
    ) {
      try {
        const ydoc = new Y.Doc();
        Y.applyUpdate(ydoc, req.body);
        blocks = editor.yDocToBlocks(ydoc, 'document-store') as PartialBlock[];
      } catch (e) {
        logger('Invalid Yjs content:', e);
        res.status(400).json({ error: 'Invalid Yjs content' });
        return;
      }
    } else {
      res.status(415).json({ error: 'Unsupported Content-Type' });
      return;
    }
    if (!blocks || blocks.length === 0) {
      res.status(500).json({ error: 'No valid blocks were generated' });
      return;
    }

    // Then, convert from blocks to the output format
    if (accept === 'application/json') {
      res.status(200).json(blocks);
    } else {
      const yDocument = editor.blocksToYDoc(blocks, 'document-store');

      if (
        accept === 'application/vnd.yjs.doc' ||
        accept === 'application/octet-stream'
      ) {
        res
          .status(200)
          .setHeader('content-type', 'application/octet-stream')
          .send(Y.encodeStateAsUpdate(yDocument));
      } else if (accept === 'text/markdown') {
        res
          .status(200)
          .setHeader('content-type', 'text/markdown')
          .send(await editor.blocksToMarkdownLossy(blocks));
      } else if (accept === 'text/html') {
        res
          .status(200)
          .setHeader('content-type', 'text/html')
          .send(await editor.blocksToHTMLLossy(blocks));
      } else {
        res.status(406).json({ error: 'Unsupported format' });
      }
    }
  } catch (e) {
    logger('conversion failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  }
};
