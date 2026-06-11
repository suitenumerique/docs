import { Server, createServer } from 'http';

import * as Sentry from '@sentry/node';
import express from 'express';
import { WebSocketServer } from 'ws';

import {
  createGetConnectionsHandler,
  createResetConnectionsHandler,
  createUpgradeHandler,
} from '@/handlers';
import { corsMiddleware, httpSecurity } from '@/middlewares';
import { RoomLifecycleDeps } from '@/rooms/roomLifecycle';
import { routes } from '@/routes';
import { logger } from '@/utils';

import '../services/sentry';

/**
 * The gateway: Express for the HTTP surface, a raw `upgrade` listener for the
 * WebSocket endpoint (auth happens before the 101 handshake).
 */
export const initServer = (deps: RoomLifecycleDeps): Server => {
  const app = express();

  app.use(corsMiddleware);

  app.post(
    routes.COLLABORATION_RESET_CONNECTIONS,
    httpSecurity,
    express.json(),
    createResetConnectionsHandler(deps.redis),
  );

  app.get(
    routes.COLLABORATION_GET_CONNECTIONS,
    httpSecurity,
    createGetConnectionsHandler(deps.registry),
  );

  Sentry.setupExpressErrorHandler(app);

  app.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
  });

  app.use((req, res) => {
    logger('Invalid route:', req.url);
    res.status(403).json({ error: 'Forbidden' });
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const handleUpgrade = createUpgradeHandler({ ...deps, wss });
  server.on('upgrade', (req, socket, head) => {
    void handleUpgrade(req, socket, head);
  });

  return server;
};
