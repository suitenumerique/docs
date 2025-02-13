import { Response } from 'express';

import { PollSync, PollSyncRequest } from '@/libs/PollSync';
import { hocusPocusServer } from '@/servers/hocusPocusServer';

interface CollaborationPollPostMessagePayload {
  message64: string;
}
interface CollaborationPollPostMessageResponse {
  updated?: boolean;
  error?: string;
}

export const collaborationPollPostMessageHandler = async (
  req: PollSyncRequest<CollaborationPollPostMessagePayload>,
  res: Response<CollaborationPollPostMessageResponse>,
) => {
  const room = req.query.room;
  const canEdit = req.headers['x-can-edit'] === 'True';

  // Only editors can send messages
  if (!canEdit) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const pollSynch = new PollSync<CollaborationPollPostMessagePayload>(
    req,
    room,
    canEdit,
  );
  const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

  if (!res.headersSent && !hpDoc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  pollSynch.sendClientsMessages(req.body.message64);

  if (!res.headersSent) {
    res.status(200).json({ updated: true });
  }
};

/**
 * Polling way of handling collaboration
 * @param req
 * @param res
 */
interface CollaborationPollSyncDocResponse {
  syncDoc64?: string;
  error?: string;
}
interface CollaborationPollSyncDocBody {
  localDoc64: string;
}

export const collaborationPollSyncDocHandler = async (
  req: PollSyncRequest<CollaborationPollSyncDocBody>,
  res: Response<CollaborationPollSyncDocResponse>,
) => {
  const room = req.query.room;
  const canEdit = req.headers['x-can-edit'] === 'True';

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const pollSynch = new PollSync<CollaborationPollSyncDocBody>(
    req,
    room,
    canEdit,
  );
  const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

  if (!hpDoc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const syncDoc64 = pollSynch.sync(req.body.localDoc64);

  if (!res.headersSent) {
    res.status(200).json({ syncDoc64 });
  }
};

/**
 * SSE message handling
 * @param req
 * @param res
 */
interface CollaborationPollSSEMessageResponse {
  updatedDoc64?: string;
  stateFingerprint?: string;
  awareness64?: string;
  error?: string;
}
export const collaborationPollSSEMessageHandler = async (
  req: PollSyncRequest<void>,
  res: Response<CollaborationPollSSEMessageResponse>,
) => {
  const room = req.query.room;
  const canEdit = req.headers['x-can-edit'] === 'True';

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const pollSynch = new PollSync<void>(req, room, canEdit);
  const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

  if (!hpDoc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(': connected\n\n');

  pollSynch.pullClientsMessages(res);
};
