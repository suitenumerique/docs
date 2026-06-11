import cors from 'cors';
import { NextFunction, Request, Response } from 'express';

import {
  COLLABORATION_SERVER_ORIGIN,
  COLLABORATION_SERVER_SECRET,
  Y_PROVIDER_API_KEY,
} from '@/env';

const VALID_API_KEYS = [COLLABORATION_SERVER_SECRET, Y_PROVIDER_API_KEY];
export const allowedOrigins = COLLABORATION_SERVER_ORIGIN.split(',');

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
