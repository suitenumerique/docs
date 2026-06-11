import { Request, Response } from 'express';

import { ConnectionRegistry } from '@/registry/connectionRegistry';
import { logger } from '@/utils';

/**
 * Used by Django's save arbitration (`_can_user_edit_document`). Response
 * contract is identical to y-provider: `count` only counts connections with
 * write access, `exists` tells whether the given session is among them.
 * 404 on an empty room — Django maps it to (0, False).
 */
export const createGetConnectionsHandler =
  (registry: ConnectionRegistry) => async (req: Request, res: Response) => {
    const room = req.query.room as string | undefined;
    const sessionKey = req.query.sessionKey as string | undefined;

    if (!room) {
      res.status(400).json({ error: 'Room name not provided' });
      return;
    }
    if (!sessionKey) {
      res.status(400).json({ error: 'Session key not provided' });
      return;
    }

    try {
      const entries = await registry.listRoom(room);
      if (entries.length === 0) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      res.status(200).json({
        count: entries.filter((entry) => entry.canEdit).length,
        exists: entries.some((entry) => entry.sessionKey === sessionKey),
      });
    } catch (error) {
      logger('get-connections error', error);
      res.status(500).json({ error: 'Failed to get connections' });
    }
  };
