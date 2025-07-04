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
  res: Response<Uint8Array | ErrorResponse>,
) => {
  if (!req.body || req.body.length === 0) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  try {
    // Perform the conversion from markdown to Blocknote.js blocks
    const blocks = await editor.tryParseMarkdownToBlocks(req.body.toString());

    if (!blocks || blocks.length === 0) {
      res.status(500).json({ error: 'No valid blocks were generated' });
      return;
    }

    // Create a Yjs Document from blocks
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');

    res
      .status(200)
      .setHeader('content-type', 'application/octet-stream')
      .send(Y.encodeStateAsUpdate(yDocument));
  } catch (e) {
    logger('conversion failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  }
};
