import * as time from 'lib0/time';
import { Awareness } from 'y-protocols/awareness.js';
import * as Y from 'yjs';

import { Doc, Role } from './types';

export const currentDocRole = (abilities: Doc['abilities']): Role => {
  return abilities.destroy
    ? Role.OWNER
    : abilities.accesses_manage
      ? Role.ADMIN
      : abilities.partial_update
        ? Role.EDITOR
        : Role.READER;
};

export const toBase64 = (str: Uint8Array) =>
  Buffer.from(str).toString('base64');

export const base64ToYDoc = (base64: string) => {
  const uint8Array = Buffer.from(base64, 'base64');
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, uint8Array);
  return ydoc;
};

export const base64ToBlocknoteXmlFragment = (base64: string) => {
  return base64ToYDoc(base64).getXmlFragment('document-store');
};

export const setAwareness = (
  awareness: Awareness,
  awarenessKey: number,
  awarenessValue: Record<string, unknown>,
) => {
  awareness?.states.set(awarenessKey, awarenessValue);
  const currLocalMeta = awareness?.meta.get(awarenessKey);
  const clock = currLocalMeta === undefined ? 0 : currLocalMeta.clock + 1;
  awareness?.meta.set(awarenessKey, {
    clock,
    lastUpdated: time.getUnixTime(),
  });
};
