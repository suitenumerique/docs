import { validate as uuidValidate } from 'uuid';

import { type DocsBlockNoteEditor } from '@/docs/doc-editor/types';

const DOC_PATH_REGEX = /^\/docs\/([^/]+)\/?$/;

export type PastedDocInterlink = {
  docId: string;
  blockId?: string;
};

/**
 * When the pasted content is a bare URL pointing to a doc on this same
 * origin (e.g. copied from the address bar or "Copy link"), returns its
 * doc id (and, if present, the anchored block id from the URL hash) so
 * the paste can be turned into an interlink instead of a plain link.
 * Returns null for anything else (selections, code blocks, links mixed
 * with other text, other origins/routes).
 */
export const getPastedDocInterlink = (
  event: ClipboardEvent,
  editor: DocsBlockNoteEditor,
): PastedDocInterlink | null => {
  const hasSelection = editor.transact((tr) => !tr.selection.empty);
  if (hasSelection) {
    return null;
  }

  const isInCodeBlock = editor.transact(
    (tr) =>
      !!tr.selection.$from.parent.type.spec.code &&
      !!tr.selection.$to.parent.type.spec.code,
  );
  // If the cursor is inside a code block, we don't want to convert the pasted URL into an interlink.
  if (isInCodeBlock) {
    return null;
  }

  const text = event.clipboardData?.getData('text/plain')?.trim();
  // If the pasted text is empty or contains whitespace, it can't be a bare URL.
  if (!text || /\s/.test(text)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  // If the URL is not from the same origin as the current site, it can't be an interlink.
  if (url.origin !== window.location.origin) {
    return null;
  }

  const match = DOC_PATH_REGEX.exec(url.pathname);
  const docId = match?.[1];

  if (!docId || !uuidValidate(docId)) {
    return null;
  }

  const blockId = url.hash.slice(1) || undefined;

  return blockId ? { docId, blockId } : { docId };
};
