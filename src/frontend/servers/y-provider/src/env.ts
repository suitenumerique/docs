import { readFileSync } from 'fs';

export const COLLABORATION_LOGGING =
  process.env.COLLABORATION_LOGGING || 'false';
export const COLLABORATION_SERVER_ORIGIN =
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000';
export const COLLABORATION_SERVER_SECRET = process.env
  .COLLABORATION_SERVER_SECRET_FILE
  ? readFileSync(process.env.COLLABORATION_SERVER_SECRET_FILE, 'utf-8')
  : process.env.COLLABORATION_SERVER_SECRET || 'secret-api-key';
export const Y_PROVIDER_API_KEY = process.env.Y_PROVIDER_API_KEY_FILE
  ? readFileSync(process.env.Y_PROVIDER_API_KEY_FILE, 'utf-8')
  : process.env.Y_PROVIDER_API_KEY || 'yprovider-api-key';
export const PORT = Number(process.env.PORT || 4444);
export const SENTRY_DSN = process.env.SENTRY_DSN || '';
export const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
