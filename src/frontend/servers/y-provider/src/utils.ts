import { COLLABORATION_LOGGING } from './env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logger(...args: any[]) {
  if (COLLABORATION_LOGGING === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(new Date().toISOString(), ' --- ', ...args);
  }
}

export const toBase64 = function (str: Uint8Array) {
  return Buffer.from(str).toString('base64');
};
