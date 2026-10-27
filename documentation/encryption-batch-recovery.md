# Batch recovery of encrypted documents

When the encryption service runs its maintenance escrow, every encrypted document carries one extra copy of its key (`maintenance_wrapped_document_key`), wrapped for the maintenance key of its owner's organization. That copy lets the organization's custodians decrypt the documents in batch, offline, without their users: after a general failure of the encryption, or when an organization stops encrypting. The escrow itself, its custodians and its tool are described in the encryption service's README, section "Maintenance escrow" ([suitenumerique/encryption](https://github.com/suitenumerique/encryption)).

It is a temporary mode: while it runs, the custodians can read what it covers.

## Whose organization a copy is for

The owner of a document is its creator, as the backend records it (`creator`), never a value the browser sends: the copy decides which organization's custodians can read the document.

- **On encryption**, the vault makes the copy for the organization of the user encrypting. The backend keeps it only when that user is the creator; when an owner or an administrator encrypts a document someone else created, the copy is left empty.
- **The backfill** fills an empty copy: whoever can edit an encrypted document that has none asks the vault for one, for the creator's organization (the detail view exposes the creator's `sub` as `creator_sub` on encrypted documents), and stores it. It covers documents encrypted before the escrow covered their owner and those encrypted by someone other than their creator.
- **A share** changes neither the document key nor its owner: the copy the vault returns with it would differ from the stored one only by the randomness of the wrap, so the interface does not send it.
- **Replacing** an existing copy (`PATCH /documents/{id}/maintenance-key/`) is accepted only when the new copy is for another maintenance key than the stored one (the key id, bytes 2 to 17 of the decoded copy), as when the owner's organization moved to a new key; it takes an owner or an administrator of the document, and each replacement is logged at warning level with the document id and the ids of the old and new keys. A copy for the key the stored one is already for is refused with a 409 (`maintenance_key_already_stored`). An editor can only fill an empty copy. The backend cannot check which key is the right one, since the list of maintenance keys lives on the encryption service: a forged copy only corrupts the document for someone who can already edit it, and so corrupt it anyway. To move every document of an organization to a new key at once, see "Rotating the maintenance key" below.

## The procedure

1. **Export**, in the backend container, the documents still encrypted (the **encrypted export**, which the tool turns into a **decrypted copy** at step 2):

   ```bash
   python manage.py maintenance_export --output /tmp/export --fingerprint <the key's 40 digits>
   ```

   `--fingerprint` is the organization's maintenance key fingerprint, the 40 digits the maintenance tool and the encryption server's startup log show (spaces allowed): the command keeps the documents whose copy is for that key; without it, every escrowed document is exported, whatever its organization. `--output` must be a new or empty folder. The folder holds `manifest.ndjson` (one short line per document and per attachment) and, under their own object keys, each document's encrypted content (`<id>/file`, as the raw ciphertext the tool reads, decoded from the base64 Docs stores) and its encrypted attachments. Content goes in files rather than in the manifest, so that even a hundred thousand documents make a manifest the tool's browser parses at once. Documents in the trash are exported like the others: they can still be restored. A document one of whose attachments is missing from the bucket is left out and named in the summary: it could never be switched whole. Documents encrypted before the escrow covered their owner have no copy: the command counts them and names a few, they cannot be recovered this way until the backfill gives them one (with `--fingerprint`, that count covers every organization, since a document without a copy names no key).

2. **Decrypt**: copy the folder to a removable drive; on an isolated computer, the custodians open the maintenance tool, pick the folder, type their phrase, and save the decrypted copy (a folder, or a `.zip` archive to unzip). Items escrowed for another organization's key come back unchanged under `other-keys/<fingerprint>/`: hand them to those custodians, the import ignores them.

3. **Import** the decrypted copy, first without changing anything:

   ```bash
   python manage.py maintenance_import /tmp/decrypted --dry-run
   python manage.py maintenance_import /tmp/decrypted
   ```

   The import refuses, before touching anything, a manifest any line of which still carries `maintenanceKey` or `wrappedKey`: that is the encrypted export, not the decrypted copy. Each document then goes back to plaintext on its own, as removing the encryption from the interface does (see below for the details). A document is left encrypted, to be exported again in a next batch, when:

   - it was edited since the export (its `updated_at` changed), checked once before its uploads and again under a lock before its switch;
   - any of its items could not be decrypted (switching the rest would drop the only key to that item);
   - its decrypted content is not a Yjs document;
   - the manifest names an attachment that is not one of the document's own encrypted attachments (listed on the document, under its `<id>/attachments/` prefix, flagged encrypted), or leaves out one of them: the manifest never decides which objects the import reads or replaces, and a document is never switched with an attachment still encrypted under a dropped key;
   - something failed before its commit: its database changes are rolled back and every object written for it is deleted.

   A document already in plaintext (decrypted from the interface since the export, or by an earlier run) is reported as such and left alone. Trashed documents are switched like the others.

4. **Check, then purge** the ciphertext the import left in the bucket. It keeps it so that a problem found afterwards (a document that does not look right, a batch to compare) can still be investigated. Once the batch is checked, it serves nothing: its keys are dropped, so it can never be opened again, and restoring an encrypted version from the document history would put ciphertext back as the content.

   ```bash
   python manage.py maintenance_purge_versions /tmp/decrypted
   python manage.py maintenance_purge_versions /tmp/decrypted --delete
   ```

   It reads the same `manifest.ndjson` as the import and, for each document now in plaintext, lists what holds ciphertext; `--delete` deletes it for good, version by version (in a versioned bucket, deleting an object without its version only adds a delete marker). A document still encrypted is never touched. With `--delete`, it also deletes what a killed import left behind (see the upload journal below), as the next import would. Only the manifest is read: it holds ids and titles, no content, so it can be kept alone until then.

5. **Delete** the encrypted export, the decrypted copy (folder or archive) and what the removable drive holds: the decrypted copy holds the content in plaintext. On the isolated computer, prefer an encrypted disk.

## Rotating the maintenance key

When an organization replaces its maintenance key (new custodians, a new phrase), every existing copy must be re-wrapped for the new public key before the old phrase is destroyed. The re-wrap happens offline in the maintenance tool, which holds the old phrase and the new public key; Docs exports the copies and writes the new ones back. Neither the content nor the attachments are involved, and no step handles a secret outside the isolated computer.

1. **The custodians generate the new phrase** in the maintenance tool, and note its public key and fingerprint.
2. **The encryption service's operator replaces the public key** in `MAINTENANCE_ESCROW_KEYS`. From then on, documents encrypted or backfilled get copies for the new key, so the export below no longer grows.
3. **Export the copies** made for the old key, in the backend container:

   ```bash
   python manage.py maintenance_export --output /tmp/keys --keys-only --fingerprint <old key's fingerprint>
   ```

   `manifest.ndjson` then holds one line per document, `{"id": ..., "type": "document", "maintenanceKey": ...}`, and nothing else: no content, no attachment, no other line.

4. **Re-wrap**: on the isolated computer, the custodians open the maintenance tool's "Rotate" tab, pick the folder, type the old phrase and paste the new public key. The tool saves a `manifest.ndjson` where each line keeps its fields, with `maintenanceKey` now the new copy and `previousMaintenanceKey` the copy it replaces; a line it could not re-wrap carries `previousMaintenanceKey` and an `error` instead of a new copy. The output holds wrapped keys only, no secret, so it can leave the isolated computer.
5. **Write the new copies back**, first without changing anything:

   ```bash
   python manage.py maintenance_rotate /tmp/rotated --dry-run
   python manage.py maintenance_rotate /tmp/rotated
   ```

   The command refuses a manifest any line of which has no `previousMaintenanceKey` (the encrypted export itself, not the tool's output). It runs in one transaction for the whole file: it writes one small column and never the object storage, so a failure rolls everything back and the command can simply run again. Each document's copy is replaced only if it is still exactly the exported one, without counting as an edit (`updated_at` is untouched); the new copy is checked as the endpoint checks one (version byte, length). The summary gives the number of copies rotated, then each document skipped and why: its copy changed since the export (its encryption removed then applied again, under a new document key: step 6 catches its copy if it is still for the old key), it no longer exists, or the tool could not re-wrap it (its `error`).
6. **Check, then destroy the old phrase**: `maintenance_export --keys-only --fingerprint <old key's fingerprint>` into a new folder must now write nothing. A document skipped, or given a copy for the old key meanwhile (encrypted or backfilled before step 2 reached every vault), needs another pass from step 3. Only then destroy the old phrase: it still opens any copy left behind.

## What the import writes, in order

Docs requires a versioned bucket, and the import relies on it for the one object it writes over. For each document:

0. **Before the first document**, the run takes a PostgreSQL advisory lock (`pg_try_advisory_lock`), which `maintenance_purge_versions` takes too: a second run refuses to start while one holds it. Under that lock, it processes the upload journal a killed run may have left (see below).
1. **Checks, without a lock**: the document exists, is still encrypted and unchanged (`updated_at`), its content reads as Yjs, its attachments are exactly its own encrypted ones.
2. **Uploads, outside any transaction**: first, one row per new key in the upload journal (`MaintenanceImportUpload`: object key, document id, creation time), committed on its own before any upload. Then each decrypted attachment goes to a new key, `<id>/attachments/<uuid>.<ext>`, as the upload endpoint stores any attachment: its type detected from its bytes, an unsafe one flagged and suffixed `-unsafe`, shown inline only when it is a safe image, under its original file name and owner, and `status=processing` until the malware scan. The ciphertext objects are not touched, so the document still opens, encrypted, during that time.
3. **Content rewritten**: the decrypted Yjs update is applied to a document, every element's `url` naming an old attachment key is rewritten to the new key (the `/media/<key>` form and the `media-check/?key=` form), as the interface does when it removes a document's encryption, and the full state becomes the new content.
4. **One short transaction**: the row locked, still encrypted and unchanged checked again, `attachments` pointed at the new keys (the media authorization serves a key only to readers of a document listing it), the per-user wrapped keys and the maintenance copy dropped, the encryption flag cleared; then, last before the commit, the content written to `<id>/file` (its key is fixed, so it is a new version over the ciphertext). The same transaction deletes the document's journal rows, so they disappear only if the switch commits. After a failure before the commit, the import deletes the objects it wrote and their rows (a row whose object could not be deleted stays, for the next run).
5. **After the commit**: the new attachments are sent to the malware scan and the cached content metadata dropped. A failure there is reported in the summary ("Switched ..., but ...") and never undoes the commit: running the import again sends to the scan any attachment of a switched document still waiting for it.

The old ciphertext stays in the bucket after the commit, out of reach (the document no longer lists the old attachment keys), until `maintenance_purge_versions` deletes it: the old attachment objects, every version of them flagged encrypted, and the encrypted versions of the content. Until then, do not restore an encrypted version from the document history: it would put ciphertext back as the content.

**The upload journal.** A run killed during the uploads, or before its switch commits, gets no chance to undo anything: it leaves the document encrypted and intact, plaintext objects under new keys that no document lists, and the journal rows naming exactly those keys. The next import (or `maintenance_purge_versions --delete`) processes every row first: a key no document lists (`attachments`) is deleted with all its versions and delete markers, then its row; a key a document lists (its switch committed, only the row survived) keeps its object and loses its row. Taking every row, without a grace period, is safe because of the advisory lock: no other run can be uploading meanwhile. The content is not journaled: its write is the last step before the commit, and the next run repairs it (below). A run killed between the content write and the commit leaves a row still encrypted over plaintext content: the document does not open in Docs until the import runs again and switches it. A run killed after the commit leaves a switched document whose attachments may wait for their scan: the next run sends them.

**What the purge deletes from the content history.** Below the current plaintext version (and any other plaintext version an interrupted run wrote over it), the run of versions that do not read as a Yjs update, down to the first version that does. The versions below that one, the history from before the document was encrypted, are kept whatever they hold. One limit follows: for a document encrypted, decrypted, then encrypted again before the batch, only the last encrypted run is deleted, since nothing tells an older one apart from a damaged plaintext version.

## Testing a batch recovery

**On every run, without a browser.** `src/backend/core/tests/data/maintenance_escrow/` is a fixture made once with the encryption service's code: an encrypted document escrowed for the encryption service's development maintenance key, whose content (a Yjs document, as the editor saves it) shows two image attachments, one by its `/media/` URL and one by its `media-check` URL, and a document escrowed for another organization's key. It holds each object as the bucket stores it, what the maintenance tool decrypts it to, and the development phrase and fingerprint (public development fixtures, never a real key). `core/tests/commands/test_maintenance_fixture.py` seeds it (`core/tests/utils/maintenance_fixture.py`), runs `maintenance_export --fingerprint`, checks the export is what the tool reads, builds the decrypted copy as the tool would, runs `maintenance_import` and reads the document back through the API. It covers the export and import formats, not the tool.

**Regenerating the fixture**, only when the format changes on purpose, from a checkout of the encryption service (its crypto, its tsconfig paths and tsx), with this frontend's dependencies installed:

```bash
cd <encryption checkout> && npx tsx <docs checkout>/src/frontend/apps/e2e/maintenance-fixture/generate.mts
```

Its randomness is seeded: a rerun without a change rewrites the same bytes, so the diff shows only what changed.

**With the real tool, by hand.** `src/frontend/apps/e2e/__tests__/app-impress/doc-maintenance-recovery.spec.ts` is skipped unless `MAINTENANCE_TOOL` names the tool, a path to the built file or the URL an encryption service serves it at (`https://<interface host>/public-assets/maintenance-tool.html`). It seeds the fixture for the signed-in e2e user, exports it in the `app-dev` container (`docker compose exec`, so the stack must be up), decrypts it in the tool with the development phrase, imports the archive, opens the document and checks its text and images, then deletes what it created. A second test first rotates the copy to a second development key (`nextMaintenance` in `fixture.json`) through the tool's Rotate tab and `maintenance_rotate`, checks that nothing is left for the old key, then recovers with the new phrase. Chromium only:

```bash
cd src/frontend/apps/e2e
MAINTENANCE_TOOL=/path/to/maintenance-tool.html yarn test --project=chromium doc-maintenance-recovery
```

The fixture is encrypted for the development key, whose phrase any build of the tool accepts: pointed at a deployed instance's URL, the test checks the very tool a recovery would use.
