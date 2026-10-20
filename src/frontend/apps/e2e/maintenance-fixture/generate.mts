/**
 * Writes the batch recovery fixture, `src/backend/core/tests/data/maintenance_escrow/`:
 * encrypted documents exactly as Docs stores them, escrowed for the encryption
 * service's development maintenance key, with what they decrypt to. The backend
 * tests seed it and run `maintenance_export` and `maintenance_import` on it
 * (`core/tests/commands/test_maintenance_fixture.py`, through
 * `core/tests/utils/maintenance_fixture.py`), and the opt-in browser test
 * (`__tests__/app-impress/doc-maintenance-recovery.spec.ts`) hands its export to the
 * real maintenance tool.
 *
 * Run by hand, only when the format changes on purpose, with the encryption
 * service's code (its crypto, its development key) from a checkout of it:
 *
 *   cd <encryption checkout> && npx tsx <docs checkout>/src/frontend/apps/e2e/maintenance-fixture/generate.mts
 *
 * tsx and the `@encryption/src/...` paths come from that checkout (its tsconfig);
 * yjs and BlockNote come from this frontend's node_modules (`yarn install` first).
 * The randomness is seeded, as the encryption service's own sample export does it:
 * a rerun without a change rewrites the same bytes.
 *
 * What it writes:
 *   - `fixture.json`: the documents (ids, titles, maintenance copies, the texts they
 *     show, their attachments), the development phrase and fingerprint, and a
 *     second development key the rotation test moves the copies to (public
 *     development fixtures, never a real key);
 *   - `objects/<object key>`: each object as the bucket holds it, the content
 *     `<id>/file` as the base64 text of its ciphertext, an attachment as its raw
 *     ciphertext (the frontend uploads it as an `application/octet-stream` file);
 *   - `plaintext/<object key>`: what the maintenance tool decrypts each one to, the
 *     raw Yjs update for a content, the PNG for an attachment.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let counter = 0;

// libsodium and Yjs draw every random byte from here: replaced before they load,
// hence the dynamic imports below.
Object.defineProperty(globalThis.crypto, 'getRandomValues', {
  configurable: true,
  value: <T extends ArrayBufferView>(array: T): T => {
    const bytes = new Uint8Array(
      array.buffer,
      array.byteOffset,
      array.byteLength,
    );

    for (let offset = 0; offset < bytes.length; offset += 32) {
      bytes.set(
        createHash('sha256')
          .update(`docs-maintenance-fixture:${counter++}`)
          .digest()
          .subarray(0, bytes.length - offset),
        offset,
      );
    }

    return array;
  },
});

const { encryptContent, generateSymmetricKey, uint8ToBase64 } =
  await import('@encryption/src/crypto');
const {
  importMaintenancePublicKey,
  maintenanceKeyIdToFingerprint,
  wrapKeyForMaintenance,
} = await import('@encryption/src/crypto/maintenance-escrow');
const {
  DEV_MAINTENANCE_PHRASE,
  DEV_MAINTENANCE_PUBLIC_KEY,
  DEV_NEXT_MAINTENANCE_PHRASE,
  DEV_NEXT_MAINTENANCE_PUBLIC_KEY,
} = await import('@encryption/src/maintenance/dev-maintenance-key');
const { SAMPLE_IMAGES, sampleOtherOrganizationKey } =
  await import('@encryption/src/maintenance/testing');
const { DOMAIN_CONTENT } =
  await import('@encryption/src/shared/crypto-domains');
const Y = await import('yjs');
const { ServerBlockNoteEditor } = await import('@blocknote/server-util');

const ROOT = resolve(
  import.meta.dirname,
  '../../../../backend/core/tests/data/maintenance_escrow',
);
// As the e2e stack and the development environment serve the API and the media.
const API_ORIGIN = 'http://localhost:8071';
const MEDIA_BASE_URL = 'http://localhost:8083';

const IDS = {
  report: 'd0c5e5c0-0000-4000-8000-000000000001',
  logo: 'd0c5e5c0-0000-4000-8000-0000000000a1',
  chart: 'd0c5e5c0-0000-4000-8000-0000000000a2',
  elsewhere: 'd0c5e5c0-0000-4000-8000-000000000002',
};

const editor = ServerBlockNoteEditor.create();

/** A content as the editor saves it: BlockNote blocks in the `document-store` fragment, the raw Yjs update. */
const yjsUpdate = (
  blocks: Parameters<typeof editor.blocksToYXmlFragment>[0],
) => {
  const doc = new Y.Doc();

  // Fixed, rather than drawn: the update names its client.
  doc.clientID = 1;
  editor.blocksToYXmlFragment(blocks, doc.getXmlFragment('document-store'));

  return Y.encodeStateAsUpdate(doc);
};

const ours = await importMaintenancePublicKey(DEV_MAINTENANCE_PUBLIC_KEY);
const theirs = await sampleOtherOrganizationKey();

const attachments = {
  logo: {
    key: `${IDS.report}/attachments/${IDS.logo}.png`,
    fileName: 'logo.png',
    plaintext: SAMPLE_IMAGES.red,
  },
  chart: {
    key: `${IDS.report}/attachments/${IDS.chart}.png`,
    fileName: 'graphique.png',
    plaintext: SAMPLE_IMAGES.blue,
  },
};

const documents = [
  {
    id: IDS.report,
    title: 'Compte rendu chiffré',
    publicKey: ours,
    texts: [
      'Compte rendu de la cellule de crise',
      'Ce texte a été récupéré par la procédure de recouvrement.',
    ],
    attachments: [attachments.logo, attachments.chart],
    // The two forms the editor gives an attachment's `url`: the media URL the upload
    // loader settles on once the file is ready, and the `media-check` URL the upload
    // returns, which a block keeps until then.
    urls: [
      `${MEDIA_BASE_URL}/media/${attachments.logo.key}`,
      `${API_ORIGIN}/api/v1.0/documents/${IDS.report}/media-check/?key=${encodeURIComponent(attachments.chart.key)}`,
    ],
  },
  {
    id: IDS.elsewhere,
    title: "Note de l'autre organisation",
    publicKey: theirs,
    texts: ["Note de l'autre organisation", 'Elle ne sort pas avec la nôtre.'],
    attachments: [],
    urls: [],
  },
];

const files: Record<string, Uint8Array | string> = {};
const lines = [];

for (const document of documents) {
  const key = await generateSymmetricKey();
  const [heading, paragraph] = document.texts;
  const content = yjsUpdate([
    {
      id: `${document.id}-heading`,
      type: 'heading',
      props: { level: 1 },
      content: heading,
    },
    {
      id: `${document.id}-paragraph`,
      type: 'paragraph',
      content: paragraph,
    },
    ...document.attachments.map((attachment, index) => ({
      id: `${document.id}-image-${index}`,
      type: 'image' as const,
      props: {
        url: document.urls[index],
        name: attachment.fileName,
        showPreview: true,
      },
    })),
  ]);
  const fileKey = `${document.id}/file`;

  // The frontend sends the ciphertext in base64, which the backend stores as is.
  files[`objects/${fileKey}`] = uint8ToBase64(
    await encryptContent(content, key, DOMAIN_CONTENT),
  );
  files[`plaintext/${fileKey}`] = content;

  for (const attachment of document.attachments) {
    // Encrypted with the document's own key, as the editor's upload does.
    files[`objects/${attachment.key}`] = await encryptContent(
      attachment.plaintext,
      key,
      DOMAIN_CONTENT,
    );
    files[`plaintext/${attachment.key}`] = attachment.plaintext;
  }

  lines.push({
    id: document.id,
    title: document.title,
    fingerprint: maintenanceKeyIdToFingerprint(document.publicKey.keyId),
    maintenanceKey: uint8ToBase64(
      await wrapKeyForMaintenance(key, document.publicKey),
    ),
    file: fileKey,
    texts: document.texts,
    attachments: document.attachments.map(({ key: objectKey, fileName }) => ({
      key: objectKey,
      fileName,
    })),
  });
}

const fixture = {
  // Public development fixtures of the encryption service, never a real key.
  phrase: DEV_MAINTENANCE_PHRASE,
  fingerprint: maintenanceKeyIdToFingerprint(ours.keyId),
  // The key the rotation test moves the copies to: the tool needs its public
  // key, the recovery after it its phrase.
  nextMaintenance: {
    phrase: DEV_NEXT_MAINTENANCE_PHRASE,
    publicKey: DEV_NEXT_MAINTENANCE_PUBLIC_KEY,
    fingerprint: maintenanceKeyIdToFingerprint(
      (await importMaintenancePublicKey(DEV_NEXT_MAINTENANCE_PUBLIC_KEY)).keyId,
    ),
  },
  documents: lines,
};

rmSync(ROOT, { recursive: true, force: true });

for (const [path, data] of Object.entries({
  ...files,
  'fixture.json': `${JSON.stringify(fixture, null, 2)}\n`,
})) {
  mkdirSync(dirname(resolve(ROOT, path)), { recursive: true });
  writeFileSync(resolve(ROOT, path), data);
}

console.log(`Batch recovery fixture written to ${ROOT}`);
