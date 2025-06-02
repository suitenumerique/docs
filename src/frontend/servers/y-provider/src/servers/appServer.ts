// eslint-disable-next-line import/order
import '../services/sentry';
import * as Sentry from '@sentry/node';
import express from 'express';
import expressWebsockets from 'express-ws';

import { PORT } from '../env';
import {
  collaborationResetConnectionsHandler,
  collaborationWSHandler,
  convertMarkdownHandler,
  convertBlocksHandler,
} from '../handlers';
import { corsMiddleware, httpSecurity, wsSecurity } from '../middlewares';
import { routes } from '../routes';
import { logger } from '../utils';

/**
 * init the collaboration server.
 *
 * @returns An object containing the Express app, Hocuspocus server, and HTTP server instance.
 */
export const initServer = () => {
  const { app } = expressWebsockets(express());
  app.use((req, res, next) => {
    if (req.path === routes.CONVERT_MARKDOWN) {
      // Large transcript files are bigger than the default '100kb' limit
      return express.json({ limit: '500kb' })(req, res, next);
    }
    express.json()(req, res, next);
  });
  app.use(corsMiddleware);

  /**
   * Route to handle WebSocket connections
   */
  app.ws(routes.COLLABORATION_WS, wsSecurity, collaborationWSHandler);

  /**
   * Route to reset connections in a room:
   *  - If no user ID is provided, close all connections in the room
   *  - If a user ID is provided, close connections for the user in the room
   */
  app.post(
    routes.COLLABORATION_RESET_CONNECTIONS,
    httpSecurity,
    collaborationResetConnectionsHandler,
  );

  /**
   * Route to convert markdown
   */
  app.post(routes.CONVERT_MARKDOWN, httpSecurity, convertMarkdownHandler);

  app.post(routes.CONVERT_BLOCKS, httpSecurity, convertBlocksHandler);

  Sentry.setupExpressErrorHandler(app);

  app.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
  });

  app.use((req, res) => {
    logger('Invalid route:', req.url);
    res.status(403).json({ error: 'Forbidden' });
  });

  const server = app.listen(PORT, () =>
    console.log('App listening on port :', PORT),
  );

  return { app, server };
};
