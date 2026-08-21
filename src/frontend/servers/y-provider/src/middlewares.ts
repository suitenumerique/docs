import cors from 'cors';
import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { COLLABORATION_SERVER_ORIGIN, JWKS_URL } from '@/env';

const allowedOrigins = COLLABORATION_SERVER_ORIGIN.split(',');

export const corsMiddleware = cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
});

// Cached across requests: fetches the Django backend's public keys lazily and
// keeps them until their "kid" no longer matches a token, per jose's own policy.
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

// Requiring this audience stops a valid admin JWT issued for another service
// from being replayed against y-provider.
const Y_CONVERTER_AUDIENCE = 'y-converter';
export const JWT_ALGORITHM = 'RS256';

/**
 * Verify that the given token is an admin JWT signed by the Django backend
 * for the y-converter audience.
 */
const isValidAdminToken = async (token: string): Promise<boolean> => {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: [JWT_ALGORITHM],
      audience: Y_CONVERTER_AUDIENCE,
    });
    return payload.admin === true;
  } catch {
    return false;
  }
};

export const httpSecurity = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let apiKey = req.headers['authorization'];

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized: No credentials given' });
    return;
  }

  if (apiKey?.startsWith('Bearer ')) {
    apiKey = apiKey.slice('Bearer '.length);
  }

  if (!(await isValidAdminToken(apiKey))) {
    res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    return;
  }

  next();
};
