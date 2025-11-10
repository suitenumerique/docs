import cors from 'cors';
import { NextFunction, Request, Response } from 'express';
import * as ws from 'ws';

import {
  COLLABORATION_SERVER_ORIGIN,
  COLLABORATION_SERVER_SECRET,
  Y_PROVIDER_API_KEY,
} from '@/env';

import { logger } from './utils';

const VALID_API_KEYS = [COLLABORATION_SERVER_SECRET, Y_PROVIDER_API_KEY];
const allowedOrigins = COLLABORATION_SERVER_ORIGIN.split(',');

export const corsMiddleware = cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
});

export const httpSecurity = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let apiKey = req.headers['authorization'];

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized: No credentials given' });
    return;
  }

  if (apiKey?.startsWith('Bearer ')) {
    apiKey = apiKey.slice('Bearer '.length);
  }

  if (!VALID_API_KEYS.includes(apiKey)) {
    res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    return;
  }

  next();
};

export const wsSecurity = (
  ws: ws.WebSocket,
  req: Request,
  next: NextFunction,
): void => {
  // Origin check
  const origin = req.headers['origin'];
  if (!origin || !allowedOrigins.includes(origin)) {
    ws.close(4001, 'Origin not allowed');
    logger('CORS policy violation: Invalid Origin', origin);
    return;
  }

  const cookies = req.headers['cookie'];
  if (!cookies) {
    ws.close(4001, 'No cookies');
    logger('CORS policy violation: No cookies');
    logger('UA:', req.headers['user-agent']);
    logger('URL:', req.url);
    return;
  }

  next();
};
