/**
 * One pair of browsers on one document: a writer and a reader. In a loop, the
 * writer opens the document, waits for the editor, types a unique token; the
 * reader, already on the document, waits for that token to show. What is
 * timed is what a user would feel — from the navigation to the editor being
 * usable, and from a keystroke to its arrival on another screen — through the
 * real frontend, the real editor and the real collaboration path.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, BrowserContext, Page } from 'playwright';

import type { Config } from './config.js';
import type { Manifest, Session } from './manifest.js';
import * as metrics from './metrics.js';
import type { Samples } from './stats.js';

const TITLE = '[aria-label="Document title"], input[name="title"], h1';
const EDITOR = '.--docs--editor-container .ProseMirror';
// where the e2e helpers click to type at the end of the document
const TRAILING_BLOCK = '.bn-trailing-block.ProseMirror-widget';
// 32 alphanumeric characters, what Django accepts as a CSRF secret
const CSRF_TOKEN = 'canaryloadtestcanaryloadtest0000';

// A user who never opened Docs is shown a tour on the first document. It sits
// over the editor: skipped when it shows, as that user would.
const dismissOnboarding = async (page: Page): Promise<void> => {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
    await skip.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
};

/**
 * Put the caret at the end of the document, the way the e2e helpers do. A click
 * the tour intercepts is retried once the tour is skipped, until `timeoutMs`.
 */
const focusEnd = async (page: Page, timeoutMs: number): Promise<void> => {
  const editor = page.locator(EDITOR).first();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await dismissOnboarding(page);
    try {
      const trailing = editor.locator(TRAILING_BLOCK);
      if ((await trailing.count()) > 0) await trailing.click({ timeout: 3000 });
      else await editor.click({ timeout: 3000 });
      break;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
  }
  await page.keyboard.press('Control+End');
};

export interface PairOptions {
  id: number;
  config: Config;
  session: Session | null;
  cookieName: string;
  doc: string;
  samples: { pageOpen: Samples; editorReady: Samples; propagation: Samples };
  log: (line: string) => void;
}

export interface IterationResult {
  pageOpen?: number;
  editorReady?: number;
  propagation?: number;
  failedStep?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The document every browser of the run opens for a pair: `--doc`, else the user's. */
export const documentFor = (
  config: Config,
  session: Session | null,
  manifest: Manifest | null,
  pairId: number,
): string | null => {
  if (config.doc) return config.doc;
  if (!session) return null;
  const own = session.editable_documents;
  const pool = own.length > 0 ? own : (manifest?.public_documents ?? []);
  return pool.length > 0 ? pool[pairId % pool.length] : null;
};

export class Pair {
  readonly options: PairOptions;
  private writer: BrowserContext | null = null;
  private reader: BrowserContext | null = null;
  private readerPage: Page | null = null;
  private seq = 0;

  constructor(options: PairOptions) {
    this.options = options;
  }

  private async context(
    browser: Browser,
    role: string,
  ): Promise<BrowserContext> {
    const { config, session, cookieName } = this.options;
    const context = await browser.newContext({
      ...(config.storageState ? { storageState: config.storageState } : {}),
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    if (session) {
      const url = new URL(config.url);
      // what a login would have left: the session, on the host of the
      // application, which is the host of its API as well (a cookie ignores
      // the port, so the dev stack's :3000 and :8071 share it)
      const cookie = {
        domain: url.hostname,
        path: '/',
        secure: url.protocol === 'https:',
        sameSite: 'Lax' as const,
      };
      await context.addCookies([
        {
          ...cookie,
          name: cookieName,
          value: session.session_key,
          httpOnly: true,
        },
        // Django's double-submit CSRF token, which the frontend reads to sign
        // its POSTs (the title, "onboarding done", ...). A login leaves one
        // behind; any value does as long as the cookie and the header agree.
        { ...cookie, name: 'csrftoken', value: CSRF_TOKEN, httpOnly: false },
      ]);
    }
    context.on('page', (page) => {
      page.on('console', (message) => {
        if (message.type() === 'error') metrics.consoleErrors.inc();
      });
      page.on('pageerror', () => metrics.consoleErrors.inc());
    });
    context.setDefaultTimeout(config.timeout * 1000);
    void role;
    return context;
  }

  async open(browser: Browser): Promise<void> {
    this.writer = await this.context(browser, 'writer');
    this.reader = await this.context(browser, 'reader');
    // the reader stays on the document for the whole run, like a colleague
    // who has the page open: it only measures propagation
    this.readerPage = await this.reader.newPage();
    await this.readerPage.goto(
      `${this.options.config.url}/docs/${this.options.doc}/`,
    );
    await this.readerPage.locator(EDITOR).first().waitFor({ state: 'visible' });
    await dismissOnboarding(this.readerPage);
  }

  /** One iteration: open, wait for the editor, type, watch the reader. */
  async iterate(): Promise<IterationResult> {
    const { config, doc } = this.options;
    if (!this.writer || !this.readerPage) throw new Error('pair not opened');
    const result: IterationResult = {};
    const page = await this.writer.newPage();
    try {
      const started = Date.now();
      await page.goto(`${config.url}/docs/${doc}/`, { waitUntil: 'commit' });
      await page
        .locator(TITLE)
        .first()
        .waitFor({ state: 'visible' })
        .catch((err) => {
          result.failedStep = 'page-open';
          throw err;
        });
      result.pageOpen = (Date.now() - started) / 1000;
      metrics.pageOpen.observe(result.pageOpen);
      this.options.samples.pageOpen.add(result.pageOpen);

      const editor = page.locator(`${EDITOR}[contenteditable="true"]`).first();
      await editor.waitFor({ state: 'visible' }).catch((err) => {
        result.failedStep = 'editor-ready';
        throw err;
      });
      result.editorReady = (Date.now() - started) / 1000;
      metrics.editorReady.observe(result.editorReady);
      this.options.samples.editorReady.add(result.editorReady);

      // type at the end of the document, where nobody is
      this.seq += 1;
      const token = `canary-${this.options.id}-${process.pid}-${this.seq}`;
      await dismissOnboarding(page);
      await focusEnd(page, config.timeout * 1000).catch((err) => {
        result.failedStep = 'focus';
        throw err;
      });
      const typed = Date.now();
      await page.keyboard.type(token);
      await this.readerPage
        .locator(EDITOR)
        .first()
        .getByText(token)
        .first()
        .waitFor({ state: 'visible' })
        .catch((err) => {
          result.failedStep = 'propagation';
          throw err;
        });
      result.propagation = (Date.now() - typed) / 1000;
      metrics.propagation.observe(result.propagation);
      this.options.samples.propagation.add(result.propagation);

      // leave the document as it was found
      for (let i = 0; i < token.length; i++)
        await page.keyboard.press('Backspace');
      await sleep(200);
      metrics.iterations.inc({ result: 'ok' });
    } catch (err) {
      result.failedStep = result.failedStep ?? 'unknown';
      result.error =
        err instanceof Error ? err.message.split('\n')[0] : String(err);
      metrics.iterations.inc({ result: 'failed' });
      metrics.failures.inc({ step: result.failedStep });
      if (config.screenshots) {
        mkdirSync(config.screenshots, { recursive: true });
        await page
          .screenshot({
            path: join(
              config.screenshots,
              `pair${this.options.id}-${Date.now()}-${result.failedStep}.png`,
            ),
          })
          .catch(() => {});
      }
    } finally {
      await page.close().catch(() => {});
    }
    return result;
  }

  async close(): Promise<void> {
    await this.reader?.close().catch(() => {});
    await this.writer?.close().catch(() => {});
    this.reader = null;
    this.writer = null;
    this.readerPage = null;
  }
}
