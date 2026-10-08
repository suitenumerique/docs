import { describe, expect, it } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { getPastedDocInterlink } from '../pasteInterlink';

const VALID_DOC_ID = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

const makeEditor = (
  opts: { selectionEmpty?: boolean; inCodeBlock?: boolean } = {},
) => {
  const { selectionEmpty = true, inCodeBlock = false } = opts;

  const tr = {
    selection: {
      empty: selectionEmpty,
      $from: { parent: { type: { spec: { code: inCodeBlock } } } },
      $to: { parent: { type: { spec: { code: inCodeBlock } } } },
    },
  };

  return {
    transact: (fn: (transaction: typeof tr) => unknown) => fn(tr),
  } as unknown as DocsBlockNoteEditor;
};

const makeClipboardEvent = (text: string | undefined) =>
  ({
    clipboardData: {
      getData: () => text,
    },
  }) as unknown as ClipboardEvent;

describe('getPastedDocInterlink', () => {
  it('returns null when the editor has a non-empty selection', () => {
    const editor = makeEditor({ selectionEmpty: false });
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the cursor is inside a code block', () => {
    const editor = makeEditor({ inCodeBlock: true });
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the clipboard has no text', () => {
    const editor = makeEditor();

    expect(
      getPastedDocInterlink(makeClipboardEvent(undefined), editor),
    ).toBeNull();
    expect(getPastedDocInterlink(makeClipboardEvent(''), editor)).toBeNull();
    expect(getPastedDocInterlink(makeClipboardEvent('   '), editor)).toBeNull();
  });

  it('returns null when the pasted text contains whitespace', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(
      getPastedDocInterlink(makeClipboardEvent(`some text ${url}`), editor),
    ).toBeNull();
  });

  it('returns null when the pasted text is not a valid URL', () => {
    const editor = makeEditor();

    expect(
      getPastedDocInterlink(makeClipboardEvent('not-a-url'), editor),
    ).toBeNull();
  });

  it('returns null for a URL on a different origin', () => {
    const editor = makeEditor();
    const url = `https://not-the-same-origin.example/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the path is not a doc route', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/settings/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns null when the doc id in the path is not a valid uuid', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/not-a-uuid/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toBeNull();
  });

  it('returns the doc id for a same-origin doc URL with a trailing slash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
    });
  });

  it('returns the doc id for a same-origin doc URL without a trailing slash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
    });
  });

  it('returns the doc id when the URL has a query string or hash', () => {
    const editor = makeEditor();
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/?foo=bar#section`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
      blockId: 'section',
    });
  });

  it('returns the block id from the URL hash when present', () => {
    const editor = makeEditor();
    const blockId = '0b0566d8-56d3-4901-8163-d887c3c3bc0c';
    const url = `${window.location.origin}/docs/${VALID_DOC_ID}/#${blockId}`;

    expect(getPastedDocInterlink(makeClipboardEvent(url), editor)).toEqual({
      docId: VALID_DOC_ID,
      blockId,
    });
  });
});
