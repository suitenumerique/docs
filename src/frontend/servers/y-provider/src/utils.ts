import * as Y from 'yjs';

import { COLLABORATION_LOGGING } from './env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logger(...args: any[]) {
  if (COLLABORATION_LOGGING === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(...args);
  }
}

export const toBase64 = function (uInt8Array: Uint8Array) {
  return Buffer.from(uInt8Array).toString('base64');
};

export const base64ToYDoc = (base64: string) => {
  const uint8Array = Buffer.from(base64, 'base64');
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, uint8Array);
  return ydoc;
};
