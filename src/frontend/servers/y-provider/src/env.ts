import { readFileSync } from 'fs';

export const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
export const COLLABORATION_LOGGING =
  process.env.COLLABORATION_LOGGING || 'false';
export const COLLABORATION_SERVER_ORIGIN =
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000';
// TODO(yhub): unused since the yhub migration, mirrors the Django setting of
// the same name (see impress/settings.py). Kept until CollaborationService is
// reinstated.
export const COLLABORATION_SERVER_SECRET = process.env
  .COLLABORATION_SERVER_SECRET_FILE
  ? readFileSync(process.env.COLLABORATION_SERVER_SECRET_FILE, 'utf-8')
  : process.env.COLLABORATION_SERVER_SECRET || 'secret-api-key';
export const CONVERSION_FILE_MAX_SIZE = process.env.CONVERSION_FILE_MAX_SIZE
  ? Number(process.env.CONVERSION_FILE_MAX_SIZE)
  : 20971520; // 20 MB default
// JWKS of the Django backend, used to verify the JWT it signs when calling us.
export const JWKS_URL =
  process.env.JWKS_URL || `${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/jwks`;
export const PORT = Number(process.env.PORT || 4444);
export const SENTRY_DSN = process.env.SENTRY_DSN || '';
