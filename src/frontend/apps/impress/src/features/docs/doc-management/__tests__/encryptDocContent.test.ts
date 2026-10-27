import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { createDocAttachment } from '@/docs/doc-editor/api';

import { countAnalyzingUploads, encryptDocContent } from '../encryptDocContent';

vi.mock('@/docs/doc-editor/api', () => ({
  createDocAttachment: vi.fn(),
}));

const DOC_ID = 'd0c5e5c0-0000-4000-8000-000000000001';
const OLD_KEY = `${DOC_ID}/attachments/d0c5e5c0-0000-4000-8000-0000000000a1.png`;
const NEW_KEY = `${DOC_ID}/attachments/d0c5e5c0-0000-4000-8000-0000000000b1.png`;
const RECIPIENTS = { 'user-sub': { email: 'user@example.com' } };
const WRAP = new Uint8Array([7, 7, 7]).buffer;

/** A vault whose "encryption" hands the plaintext back, so a test can read what was encrypted. */
const fakeVault = () => {
  const encryptWithoutKey = vi.fn((data: ArrayBuffer) =>
    Promise.resolve({
      encryptedContent: data.slice(0),
      encryptedKeys: { 'user-sub': WRAP },
      maintenanceKey: new Uint8Array([1]).buffer,
    }),
  );
  const encryptWithKey = vi.fn((data: ArrayBuffer) =>
    Promise.resolve({ encryptedData: data.slice(0) }),
  );
  const vault = { encryptWithoutKey, encryptWithKey } as unknown as VaultClient;

  return { vault, encryptWithoutKey, encryptWithKey };
};

const docWithImage = (url: string) => {
  const yDoc = new Y.Doc();
  const image = new Y.XmlElement('image');
  image.setAttribute('url', url);
  image.setAttribute('name', 'logo.png');
  yDoc.getXmlFragment('document-store').insert(0, [image]);

  return yDoc;
};

const imageUrl = (content: Uint8Array) => {
  const yDoc = new Y.Doc();
  Y.applyUpdate(yDoc, content);

  return (
    yDoc.getXmlFragment('document-store').get(0) as Y.XmlElement
  ).getAttribute('url');
};

describe('encryptDocContent', () => {
  beforeEach(() => {
    vi.mocked(createDocAttachment).mockResolvedValue({
      file: `/api/v1.0/documents/${DOC_ID}/media-check/?key=${encodeURIComponent(NEW_KEY)}`,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3])))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('the content handed back points at the encrypted copies of its attachments', async () => {
    const { vault, encryptWithKey } = fakeVault();

    const result = await encryptDocContent({
      yDoc: docWithImage(`http://localhost:8083/media/${OLD_KEY}`),
      docId: DOC_ID,
      vaultClient: vault,
      recipients: RECIPIENTS,
      currentUserSub: 'user-sub',
    });

    // The backend deletes the plaintext attachment: the content must not name it.
    expect(imageUrl(result.encryptedContent)).toBe(
      `http://localhost:8083/media/${NEW_KEY}`,
    );
    expect(result.attachmentKeyMapping).toEqual({ [OLD_KEY]: NEW_KEY });
    // The attachment, then the rewritten content, under the caller's wrap of the new key.
    expect(encryptWithKey).toHaveBeenCalledTimes(2);
    expect(encryptWithKey).toHaveBeenNthCalledWith(1, expect.anything(), WRAP);
    expect(encryptWithKey).toHaveBeenNthCalledWith(2, expect.anything(), WRAP);
    expect(result.maintenanceKey).toBeDefined();
  });

  test('without attachments, the content is encrypted once', async () => {
    const { vault, encryptWithoutKey, encryptWithKey } = fakeVault();
    const yDoc = new Y.Doc();
    yDoc.getXmlFragment('document-store').insert(0, [new Y.XmlText('Hello')]);

    const result = await encryptDocContent({
      yDoc,
      docId: DOC_ID,
      vaultClient: vault,
      recipients: RECIPIENTS,
      currentUserSub: 'user-sub',
    });

    expect(encryptWithKey).not.toHaveBeenCalled();
    expect(result.attachmentKeyMapping).toEqual({});
    // What the vault encrypted first, handed back as is.
    expect(result.encryptedContent).toEqual(
      new Uint8Array(encryptWithoutKey.mock.calls[0][0]),
    );
  });

  test('without a wrap for the caller, the attachments are left as they are', async () => {
    const { vault } = fakeVault();

    const result = await encryptDocContent({
      yDoc: docWithImage(`http://localhost:8083/media/${OLD_KEY}`),
      docId: DOC_ID,
      vaultClient: vault,
      recipients: RECIPIENTS,
      currentUserSub: 'someone-else',
    });

    expect(createDocAttachment).not.toHaveBeenCalled();
    expect(result.attachmentKeyMapping).toEqual({});
    expect(imageUrl(result.encryptedContent)).toBe(
      `http://localhost:8083/media/${OLD_KEY}`,
    );
  });
});

describe('countAnalyzingUploads', () => {
  const loader = (type?: string) => {
    const element = new Y.XmlElement('uploadLoader');
    element.setAttribute(
      'blockUploadUrl',
      `http://localhost:8071/api/v1.0/documents/${DOC_ID}/media-check/?key=${encodeURIComponent(OLD_KEY)}`,
    );
    if (type) {
      element.setAttribute('type', type);
    }
    // As BlockNote nests a block in its container.
    const container = new Y.XmlElement('blockContainer');
    container.insert(0, [element]);

    return container;
  };

  test('counts the files still being analyzed, not the ones the scan refused', () => {
    const yDoc = docWithImage(`http://localhost:8083/media/${OLD_KEY}`);
    yDoc
      .getXmlFragment('document-store')
      .insert(1, [loader('loading'), loader(), loader('warning')]);

    expect(countAnalyzingUploads(yDoc)).toBe(2);
  });

  test('a document without loaders has none', () => {
    expect(
      countAnalyzingUploads(
        docWithImage(`http://localhost:8083/media/${OLD_KEY}`),
      ),
    ).toBe(0);
  });
});
