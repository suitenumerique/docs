// The measurement loop, against a page of its own served in-process: an
// "editor" that shows a skeleton, then a contenteditable, behind a tour that
// has to be skipped, and mirrors what is typed into a second tab through a
// BroadcastChannel — enough to check what the canary times, and that it skips
// the tour and reports the steps that fail.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Pair, documentFor } from '../src/canary.js';
import { parseConfig } from '../src/config.js';
import type { Config } from '../src/config.js';
import { registry } from '../src/metrics.js';
import { Samples } from '../src/stats.js';

// The two tabs are separate browser contexts, so the text travels through the
// server: typed text is posted, and the other tab polls for it.
const PAGE = (
  readyAfterMs: number,
  withTour: boolean,
) => `<!doctype html><html><body>
<h1>Doc</h1>
<div class="--docs--editor-container"><div id="skeleton">loading</div></div>
${withTour ? '<div id="tour" style="position:fixed;inset:0;background:rgba(0,0,0,.5)"><button>Skip</button></div>' : ''}
<script>
  const container = document.querySelector('.--docs--editor-container');
  setTimeout(() => {
    container.innerHTML = '<div class="ProseMirror" contenteditable="true"><p>existing text</p></div>';
    const editor = container.firstChild;
    editor.addEventListener('input', () => fetch('/text' + location.pathname + '?set=' + encodeURIComponent(editor.textContent)));
    setInterval(async () => {
      const text = await (await fetch('/text' + location.pathname)).text();
      if (text && !editor.textContent.includes(text)) editor.textContent = text;
    }, 50);
  }, ${readyAfterMs});
  const tour = document.getElementById('tour');
  if (tour) tour.querySelector('button').addEventListener('click', () => tour.remove());
</script></body></html>`;

describe('Pair', () => {
  let browser: Browser;
  let server: Server;
  let url: string;
  let readyAfterMs = 300;
  let withTour = true;

  beforeAll(async () => {
    browser = await chromium.launch();
    const texts = new Map<string, string>();
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      if (url.pathname.startsWith('/text/')) {
        const set = url.searchParams.get('set');
        if (set !== null) texts.set(url.pathname, set);
        return res
          .writeHead(200, { 'content-type': 'text/plain' })
          .end(texts.get(url.pathname) ?? '');
      }
      if (!url.pathname.startsWith('/docs/')) return res.writeHead(404).end();
      res
        .writeHead(200, { 'content-type': 'text/html' })
        .end(PAGE(readyAfterMs, withTour));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const config = (...extra: string[]): Config =>
    parseConfig([
      '--url',
      url,
      '--storage-state',
      '',
      '--manifest',
      'm',
      '--doc',
      'd1',
      '--timeout',
      '5',
      '--metrics-port',
      '0',
      ...extra,
    ]);
  const samples = () => ({
    pageOpen: new Samples(),
    editorReady: new Samples(),
    propagation: new Samples(),
  });

  it('times the open, the editor and the propagation, skipping the tour', async () => {
    const s = samples();
    const pair = new Pair({
      id: 0,
      config: config(),
      session: {
        user_id: 'u',
        session_key: 'k',
        editable_documents: [],
        readonly_documents: [],
      },
      cookieName: 'docs_sessionid',
      doc: 'd1',
      samples: s,
      log: () => {},
    });
    await pair.open(browser);
    const result = await pair.iterate();
    await pair.close();

    expect(result.failedStep).toBeUndefined();
    expect(result.pageOpen).toBeGreaterThan(0);
    expect(result.editorReady).toBeGreaterThanOrEqual(0.3);
    expect(result.propagation).toBeGreaterThan(0);
    expect(result.propagation).toBeLessThan(3);
    expect(s.propagation.count).toBe(1);
    expect(await registry.metrics()).toMatch(
      /canary_iterations_total\{result="ok"\} 1/,
    );
  });

  it('sends the session and the csrf cookies', async () => {
    let cookie = '';
    const seen = createServer((req, res) => {
      cookie = req.headers.cookie ?? '';
      res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE(10, false));
    });
    await new Promise<void>((resolve) => seen.listen(0, '127.0.0.1', resolve));
    const seenUrl = `http://127.0.0.1:${(seen.address() as AddressInfo).port}`;
    const pair = new Pair({
      id: 1,
      config: parseConfig([
        '--url',
        seenUrl,
        '--manifest',
        'm',
        '--doc',
        'd',
        '--timeout',
        '5',
        '--metrics-port',
        '0',
      ]),
      session: {
        user_id: 'u',
        session_key: 'the-key',
        editable_documents: [],
        readonly_documents: [],
      },
      cookieName: 'docs_sessionid',
      doc: 'd',
      samples: samples(),
      log: () => {},
    });
    await pair.open(browser);
    await pair.close();
    await new Promise((resolve) => seen.close(resolve));
    expect(cookie).toContain('docs_sessionid=the-key');
    expect(cookie).toMatch(/csrftoken=[A-Za-z0-9]{32}/);
  });

  it('reports the step that failed', async () => {
    readyAfterMs = 60000;
    withTour = false;
    const pair = new Pair({
      id: 2,
      config: config('--timeout', '2'),
      session: null,
      cookieName: '',
      doc: 'd2',
      samples: samples(),
      log: () => {},
    });
    await expect(pair.open(browser)).rejects.toThrow();
    readyAfterMs = 300;
    await pair.close();
  });

  it('picks the document of the pair', () => {
    const manifest = {
      cookie_name: 'c',
      public_documents: ['p'],
      sessions: [],
    };
    const session = {
      user_id: 'u',
      session_key: 'k',
      editable_documents: ['e1', 'e2'],
      readonly_documents: [],
    };
    expect(documentFor(config(), session, manifest, 0)).toBe('d1');
    const noDoc = parseConfig([
      '--url',
      url,
      '--manifest',
      'm',
      '--metrics-port',
      '0',
    ]);
    expect(documentFor(noDoc, session, manifest, 0)).toBe('e1');
    expect(documentFor(noDoc, session, manifest, 1)).toBe('e2');
    expect(
      documentFor(noDoc, { ...session, editable_documents: [] }, manifest, 0),
    ).toBe('p');
    expect(documentFor(noDoc, null, manifest, 0)).toBeNull();
  });
});
