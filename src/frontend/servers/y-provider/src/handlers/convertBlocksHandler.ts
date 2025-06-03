//import { PartialBlock } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger, toBase64 } from '@/utils';

interface ConversionRequest {
  blocks: any; // TODO: PartialBlock
}

interface ConversionResponse {
  content: string;
}

interface ErrorResponse {
  error: string;
}

export const convertBlocksHandler = async (
  req: Request<
    object,
    ConversionResponse | ErrorResponse,
    ConversionRequest,
    object
  >,
  res: Response<ConversionResponse | ErrorResponse>,
) => {
  const blocks = req.body?.blocks;
  if (!blocks) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  try {
    const editor = ServerBlockNoteEditor.create();

    // Create a Yjs Document from blocks, and encode it as a base64 string
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const content = toBase64(Y.encodeStateAsUpdate(yDocument));

    res.status(200).json({ content });
  } catch (e) {
    logger('conversion failed:', e);
    res.status(500).json({ error: String(e) });
  }
};
