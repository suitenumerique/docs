import { Response } from 'express';

import { PollSync, PollSyncRequest } from '@/libs/PollSync';
import { hocusPocusServer } from '@/servers/hocusPocusServer';

const TIMEOUT = 30000;

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

  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request Timeout' });
    }
  }, TIMEOUT);

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

  const awareness = await pollSynch.getAwarenessStates();

  console.log('awaaaa', awareness);

  if (!res.headersSent) {
    clearTimeout(timeout);
    res.status(200).json({
      awareness,
    });
  }
};

// /**
//  * Polling way of handling collaboration
//  * @param req
//  * @param res
//  */
// interface CollaborationPollGetDocResponse {
//   updatedDoc64?: string;
//   stateFingerprint?: string;
//   error?: string;
// }
// export const collaborationPollGetDocHandler = async (
//   req: PollSyncRequest<void>,
//   res: Response<CollaborationPollGetDocResponse>,
// ) => {
//   const room = req.query.room;
//   const canEdit = req.headers['x-can-edit'] === 'True';

//   const timeout = setTimeout(() => {
//     if (!res.headersSent) {
//       res.status(408).json({ error: 'Request Timeout' });
//     }
//   }, TIMEOUT);

//   if (!room) {
//     res.status(400).json({ error: 'Room name not provided' });
//     return;
//   }

//   const pollSynch = new PollSync<void>(req, room, canEdit);
//   const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

//   if (!res.headersSent && !hpDoc) {
//     res.status(404).json({ error: 'Document not found' });
//     return;
//   }

//   const updatedDoc = await pollSynch.getUpdatedDoc();

//   if (!res.headersSent) {
//     clearTimeout(timeout);
//     res.status(200).json(updatedDoc);
//   }
// };

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

  console.log('canEdit', canEdit);

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

  pollSynch.sendMessages(req.body.message64);

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

  //hpDoc.console.log('SSE', room);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  //res.setHeader('Access-Control-Allow-Origin', COLLABORATION_SERVER_ORIGIN);

  res.write(': connected\n\n');

  pollSynch.receiveMessages(res);

  // const pollSynch = new PollSync<CollaborationPollSSEMessageBody>(
  //   req,
  //   room,
  //   canEdit,
  // );
  // const hpDoc = await pollSynch.initHocuspocusDocument(hocusPocusServer);

  // if (!hpDoc) {
  //   res.status(404).json({ error: 'Document not found' });
  //   return;
  // }

  // const syncDoc64 = pollSynch.sync(req.body.localDoc64);

  // if (!res.headersSent) {
  //   res.status(200).json({ syncDoc64 });
  // }
};

// app.get('/events', (req, res) => {
//   // 1. Set necessary headers for SSE
//   res.setHeader('Content-Type', 'text/event-stream');
//   res.setHeader('Cache-Control', 'no-cache');
//   res.setHeader('Connection', 'keep-alive');

//   // 2. Optionally set CORS headers if needed (e.g., if your SPA is on a different domain)
//   // res.setHeader('Access-Control-Allow-Origin', '*');

//   // 3. Immediately send a comment to keep the connection alive in some environments
//   res.write(': connected\n\n');

//   // 4. Example: Send an event every 5 seconds
//   const intervalId = setInterval(() => {
//     // `data:` lines contain the actual message
//     // `\n\n` is the SSE delimiter
//     res.write(`data: ${JSON.stringify({ time: new Date() })}\n\n`);
//   }, 5000);

//   // 5. If the client closes the connection, stop sending events
//   req.on('close', () => {
//     clearInterval(intervalId);
//   });
// });
