import { validate as uuidValidate } from 'uuid';

import { type DocsBlockNoteEditor } from '@/docs/doc-editor/types';

const DOC_PATH_REGEX = /^\/docs\/([^/]+)\/?$/;

export type PastedDocInterlink = {
  docId: string;
  blockId?: string;
  /** The selected text the link was pasted on, shown instead of the title */
  label?: string;
};

/**
 * When the pasted content is a bare URL pointing to a doc on this same
 * origin (e.g. copied from the address bar or "Copy link"), returns its
 * doc id (and, if present, the anchored block id from the URL hash) so
 * the paste can be turned into an interlink instead of a plain link.
 * Pasted on a selected text, the interlink keeps that text as its label.
 * Returns null for anything else (selections across blocks, code blocks,
 * links mixed with other text, other origins/routes).
 */
export const getPastedDocInterlink = (
  event: ClipboardEvent,
  editor: DocsBlockNoteEditor,
): PastedDocInterlink | null => {
  const selection = editor.transact(({ selection, doc }) => ({
    isEmpty: selection.empty,
    isInSameBlock: selection.$from.sameParent(selection.$to),
    isInCodeBlock:
      !!selection.$from.parent.type.spec.code &&
      !!selection.$to.parent.type.spec.code,
    text: doc.textBetween(selection.from, selection.to).trim(),
  }));

  // If the cursor is inside a code block, we don't want to convert the pasted URL into an interlink.
  if (selection.isInCodeBlock) {
    return null;
  }

  // A selection across blocks, or holding no text, is left to the default paste.
  if (!selection.isEmpty && (!selection.isInSameBlock || !selection.text)) {
    return null;
  }

  const text = event.clipboardData?.getData('text/plain')?.trim();
  // If the pasted text is empty or contains whitespace, it can't be a bare URL.
  if (!text || /\s/.test(text)) {
    return null;
  }

  // A relative path is not a URL copied from somewhere: it throws and stays a text.
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

  return {
    docId,
    ...(blockId && { blockId }),
    ...(!selection.isEmpty && { label: selection.text }),
  };
};
