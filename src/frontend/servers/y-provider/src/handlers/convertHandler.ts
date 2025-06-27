import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger, toBase64 } from '@/utils';

interface ConversionRequest {
  content: string;
}

interface ConversionResponse {
  content: string;
}

interface ErrorResponse {
  error: string;
}

export const convertHandler = async (
  req: Request<
    object,
    ConversionResponse | ErrorResponse,
    ConversionRequest,
    object
  >,
  res: Response<ConversionResponse | ErrorResponse>,
) => {
  const content = req.body?.content;

  if (!content) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  try {
    const editor = ServerBlockNoteEditor.create();

    // Perform the conversion from markdown to Blocknote.js blocks
    const blocks = await editor.tryParseMarkdownToBlocks(content);

    if (!blocks || blocks.length === 0) {
      res.status(500).json({ error: 'No valid blocks were generated' });
      return;
    }

    // Create a Yjs Document from blocks, and encode it as a base64 string
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const documentContent = toBase64(Y.encodeStateAsUpdate(yDocument));

    res.status(200).json({ content: documentContent });
  } catch (e) {
    logger('conversion failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  }
};
