import { validate as uuidValidate, version as uuidVersion } from 'uuid';

import { COLLABORATION_LOGGING } from './env';

export function logger(...args: unknown[]) {
  if (COLLABORATION_LOGGING === 'true') {
    console.log(new Date().toISOString(), ' --- ', ...args);
  }
}

export const isValidRoom = (room: string): boolean =>
  uuidValidate(room) && uuidVersion(room) === 4;

export const getCookieValue = (
  cookieHeader: string | undefined,
  name: string,
): string | undefined =>
  cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')[1];
