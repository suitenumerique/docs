/**
 * There is no complete end-to-end test of a batch recovery, on purpose: the
 * maintenance tool belongs to the encryption service, which Docs does not depend
 * on. This test runs the real tool only when MAINTENANCE_TOOL names it (a path to
 * the built file, or the URL a deployed encryption service serves it at,
 * /public-assets/maintenance-tool.html), and is skipped otherwise. Running it by
 * hand (before a release, before a real recovery) is a first step. To run it
 * regularly, there are two ways, each with its cost: CI fetches the tool from a
 * production instance (it always tests what a recovery would really use, but CI
 * then depends on that instance being reachable); or a copy of the file is
 * committed here (CI is self-contained, but the copy drifts from the deployed tool
 * until someone updates it). The fixtures under
 * src/backend/core/tests/data/maintenance_escrow (made once with the encryption
 * service's code for its development phrase) are tested on every run without a
 * browser, by core/tests/commands/test_maintenance_fixture.py: they cover the
 * export and import formats, not the tool.
 *
 *   MAINTENANCE_TOOL=<path or URL> yarn e2e:test --project=chromium doc-maintenance-recovery
 *
 * Two flows: a recovery with the development key; and the same recovery after the
 * copies were rotated to a second development key through the tool's Rotate tab.
 *
 * The backend commands run in the `app-dev` container of this repository's
 * compose stack (`docker compose exec`), which must be up.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

import { Page, expect, test } from '@playwright/test';

const MAINTENANCE_TOOL = process.env.MAINTENANCE_TOOL;
const REPOSITORY = path.resolve(__dirname, '../../../../../..');
const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(
      REPOSITORY,
      'src/backend/core/tests/data/maintenance_escrow/fixture.json',
    ),
    'utf8',
  ),
) as {
  phrase: string;
  fingerprint: string;
  nextMaintenance: { phrase: string; publicKey: string; fingerprint: string };
  documents: { id: string; title: string; texts: string[] }[];
};
const [DOCUMENT, ELSEWHERE] = FIXTURE.documents;
// Where the commands read and write, inside the backend container.
const WORKDIR = '/tmp/maintenance-recovery-e2e';

const backend = (args: string[], input?: Buffer) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'app-dev', ...args], {
    cwd: REPOSITORY,
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).toString();

const manage = (...args: string[]) => backend(['python', 'manage.py', ...args]);

// What the code prints last: the shell may print a banner first.
const shell = (code: string) =>
  manage(
    'shell',
    '-c',
    'from core import models; from core.tests.utils.maintenance_fixture import ' +
      `remove_maintenance_fixture, seed_maintenance_fixture; ${code}`,
  )
    .trim()
    .split('\n')
    .pop() ?? '';

test.describe('Doc maintenance recovery', () => {
  // One after the other: both seed the same fixed ids and use the same folder.
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !MAINTENANCE_TOOL,
    'MAINTENANCE_TOOL names no maintenance tool to run',
  );

  let hostDir = '';

  test.afterEach(() => {
    // Nothing was created by a run skipped in another browser.
    if (!hostDir) {
      return;
    }

    shell('remove_maintenance_fixture()');
    backend(['rm', '-rf', WORKDIR]);
    fs.rmSync(hostDir, { recursive: true, force: true });
    hostDir = '';
  });

  /** As the frontend stores them, created and owned by the user signed in here. */
  const seed = (browserName: string) => {
    hostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-recovery-'));
    shell(
      `seed_maintenance_fixture(${JSON.stringify(
        process.env[`SIGN_IN_USERNAME_${browserName.toUpperCase()}`],
      )})`,
    );
    backend(['rm', '-rf', WORKDIR]);
    backend(['mkdir', '-p', WORKDIR]);
  };

  /** An export into the container's `WORKDIR/<name>`, copied out for the tool; what it printed. */
  const exportFor = (name: string, ...args: string[]) => {
    const output = manage(
      'maintenance_export',
      '--output',
      `${WORKDIR}/${name}`,
      ...args,
    );
    execFileSync(
      'docker',
      ['compose', 'cp', `app-dev:${WORKDIR}/${name}`, path.join(hostDir, name)],
      { cwd: REPOSITORY },
    );

    return output;
  };

  // The tool, offline, as the custodians run it. Its language follows the
  // browser's, which the project sets to English.
  const openTool = (page: Page) =>
    page.goto(
      /^https?:\/\//.test(MAINTENANCE_TOOL!)
        ? MAINTENANCE_TOOL!
        : pathToFileURL(path.resolve(MAINTENANCE_TOOL!)).href,
    );

  /** The export decrypted in the tool with `phrase`, unzipped and imported in the backend container. */
  const recover = async (
    page: Page,
    name: string,
    phrase: string,
    fingerprint: string,
  ) => {
    await openTool(page);
    await page
      .locator('#mt-tabpanel-decrypt input[type="file"]')
      .setInputFiles(path.join(hostDir, name));
    await expect(page.getByRole('status').first()).toHaveText(
      `${name}: 3 items, 3 files`,
    );
    await page.locator('#mt-decrypt-word-0').fill(phrase);
    await expect
      .poll(async () =>
        (await page.locator('.mt-fingerprint').first().textContent())?.replace(
          /\s/g,
          '',
        ),
      )
      .toBe(fingerprint);
    await page
      .getByRole('button', { name: 'Decrypt into a .zip archive' })
      .click();
    await expect(page.getByText(/^3 items decrypted/)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('link', { name: 'Download the decrypted copy (.zip)' })
        .click(),
    ]);
    const archive = path.join(hostDir, `${name}.zip`);
    await download.saveAs(archive);

    backend(
      ['sh', '-c', `cat > ${WORKDIR}/${name}.zip`],
      fs.readFileSync(archive),
    );
    backend([
      'python',
      '-m',
      'zipfile',
      '-e',
      `${WORKDIR}/${name}.zip`,
      `${WORKDIR}/${name}-decrypted`,
    ]);
    const imported = manage(
      'maintenance_import',
      `${WORKDIR}/${name}-decrypted`,
    );
    expect(imported).toContain('Switched 1 documents to plaintext.');
    expect(imported).not.toContain('Skipped');
  };

  /** The document opens in plaintext, its text and images shown; the other organization's stays encrypted. */
  const expectRecovered = async (page: Page) => {
    const attachments = JSON.parse(
      shell(
        `import json; print(json.dumps(models.Document.objects.get(pk=${JSON.stringify(
          DOCUMENT.id,
        )}).attachments))`,
      ),
    ) as string[];
    expect(attachments).toHaveLength(2);

    await page.goto(`/docs/${DOCUMENT.id}/`);
    const editor = page.locator('.--docs--editor-container');

    for (const text of DOCUMENT.texts) {
      await expect(editor.getByText(text)).toBeVisible({ timeout: 15000 });
    }

    const images = editor.locator('img.bn-visual-media');
    await expect(images).toHaveCount(2, { timeout: 15000 });

    for (const [index, key] of attachments.entries()) {
      await expect(images.nth(index)).toHaveAttribute(
        'src',
        new RegExp(`/media/${key}$`),
      );
      await expect
        .poll(() =>
          images
            .nth(index)
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBe(96);
    }

    // Not exported for this key: still encrypted.
    expect(
      shell(
        `print(models.Document.objects.get(pk=${JSON.stringify(
          ELSEWHERE.id,
        )}).is_encrypted)`,
      ),
    ).toBe('True');
  };

  test('it recovers an encrypted document with the maintenance tool', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'The tool is run in Chromium only');
    test.setTimeout(180_000);
    seed(browserName);

    expect(exportFor('export', '--fingerprint', FIXTURE.fingerprint)).toContain(
      'Exported 1 documents and 2 attachments',
    );
    await recover(page, 'export', FIXTURE.phrase, FIXTURE.fingerprint);
    await expectRecovered(page);
  });

  test('it recovers a document after its copy was rotated to a new key', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'The tool is run in Chromium only');
    test.setTimeout(240_000);
    seed(browserName);
    const next = FIXTURE.nextMaintenance;

    expect(
      exportFor('keys', '--keys-only', '--fingerprint', FIXTURE.fingerprint),
    ).toContain('Exported the maintenance copies of 1 documents');

    // The custodians re-wrap the copies: the old phrase, the new public key.
    await openTool(page);
    await page.getByRole('tab', { name: 'Rotate the maintenance key' }).click();
    await page
      .locator('#mt-tabpanel-rotate input[type="file"]')
      .setInputFiles(path.join(hostDir, 'keys'));
    await expect(page.getByText('keys: 1 copies')).toBeVisible();
    await page.locator('#mt-rotate-word-0').fill(FIXTURE.phrase);
    await page
      .getByRole('textbox', { name: '3. The new public key' })
      .fill(next.publicKey);
    await page
      .getByRole('button', { name: 'Rotate and download manifest.ndjson' })
      .click();
    await expect(page.getByText('1 copies rotated, 0 failed.')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('link', {
          name: 'Download the rotated copies (manifest.ndjson)',
        })
        .click(),
    ]);
    const manifest = path.join(hostDir, 'rotated.ndjson');
    await download.saveAs(manifest);

    backend(['mkdir', '-p', `${WORKDIR}/rotated`]);
    backend(
      ['sh', '-c', `cat > ${WORKDIR}/rotated/manifest.ndjson`],
      fs.readFileSync(manifest),
    );
    const rotated = manage('maintenance_rotate', `${WORKDIR}/rotated`);
    expect(rotated).toContain('Rotated the maintenance copies of 1 documents.');
    expect(rotated).not.toContain('Skipped');

    // Nothing left for the old key: its phrase may now be destroyed.
    expect(
      exportFor(
        'keys-after',
        '--keys-only',
        '--fingerprint',
        FIXTURE.fingerprint,
      ),
    ).toContain('Exported the maintenance copies of 0 documents');
    expect(exportFor('export', '--fingerprint', next.fingerprint)).toContain(
      'Exported 1 documents and 2 attachments',
    );

    await recover(page, 'export', next.phrase, next.fingerprint);
    await expectRecovered(page);
  });
});
