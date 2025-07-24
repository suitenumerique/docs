import { PartialBlock } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger } from '@/utils';

interface ErrorResponse {
  error: string;
}

interface ContentRequest {
  content: string;
  format: string;
}

const editor = ServerBlockNoteEditor.create();

export const contentHandler = async (
  req: Request<object, object | ErrorResponse, ContentRequest, object>,
  res: Response<object | ErrorResponse>,
) => {
  const { content, format } = req.body;

  if (!content) {
    res.status(400).json({ error: 'Invalid request: missing content' });
    return;
  }

  if (!format || !['json', 'markdown', 'html'].includes(format)) {
    res
      .status(400)
      .json({ error: 'Invalid format. Must be one of: json, markdown, html' });
    return;
  }

  try {
    // Decode base64 content to Uint8Array
    const uint8Array = new Uint8Array(Buffer.from(content, 'base64'));

    // Create Yjs document and apply the update
    const yDocument = new Y.Doc();
    Y.applyUpdate(yDocument, uint8Array);

    // Convert to blocks
    const blocks = editor.yDocToBlocks(yDocument, 'document-store');

    let result: string | object | null;

    if (!blocks || blocks.length === 0) {
      result = null;
    } else if (format === 'json') {
      result = blocks;
    } else if (format === 'markdown') {
      result = await editor.blocksToMarkdownLossy(blocks as PartialBlock[]);
    } else if (format === 'html') {
      result = await editor.blocksToHTMLLossy(blocks as PartialBlock[]);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
      return;
    }

    res.status(200).json({
      content: result,
      format: format,
    });
  } catch (e) {
    logger('content conversion failed:', e);
    res.status(500).json({ error: 'An error occurred during conversion' });
  }
};
