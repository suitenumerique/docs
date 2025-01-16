import { Response } from 'express';

import { PollSync, PollSyncRequest } from '@/libs/PollSync';
import { hocusPocusServer } from '@/servers/hocusPocusServer';

/**
 * Polling way of handling collaboration
 * @param req
 * @param res
 */
export const collaborationPollGetAwarenessHandler = async (
  req: PollSyncRequest<void>,
  res: Response,
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

  setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request Timeout' });
    }
  }, 60000);

  const awareness = await pollSynch.getAwarenessStates();

  console.log('awaaaa', awareness);

  if (!res.headersSent) {
    res.status(200).json({
      awareness,
    });
  }
};

/**
 * Polling way of handling collaboration
 * @param req
 * @param res
 */
interface CollaborationPollGetDocResponse {
  updatedDoc64?: string;
  stateFingerprint?: string;
  error?: string;
}
export const collaborationPollGetDocHandler = async (
  req: PollSyncRequest<void>,
  res: Response<CollaborationPollGetDocResponse>,
) => {
  const room = req.query.room;
  const canEdit = req.headers['x-can-edit'] === 'True';

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const pollSynch = new PollSync<void>(req, room, canEdit);
  const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

  if (!res.headersSent && !hpDoc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request Timeout' });
    }
  }, 60000);

  const updatedDoc = await pollSynch.getUpdatedDoc();

  if (!res.headersSent) {
    res.status(200).json(updatedDoc);
  }
};

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

  const updated = pollSynch.messageHandler(req.body.message64);

  if (!res.headersSent) {
    res.status(200).json({ updated });
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
