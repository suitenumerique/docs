import { COLLABORATION_LOGGING } from './env';

export function logger(...args: unknown[]) {
  if (COLLABORATION_LOGGING === 'true') {
    console.log(new Date().toISOString(), ' --- ', ...args);
  }
}

export const toBase64 = function (str: Uint8Array) {
  return Buffer.from(str).toString('base64');
};
