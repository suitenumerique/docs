import { afterEach, describe, expect, test } from 'vitest';

import {
  PRINT_ONLY_CONTENT_CSS,
  wrapInterlinksWithAnchor,
  wrapMediaWithLink,
} from '../utils_print';

describe('print DOM helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('wraps media links only inside the provided root', () => {
    document.body.innerHTML = `
      <main>
        <div id="outside" data-content-type="video" data-url="https://example.com/outside.mp4" data-name="outside.mp4">
          <div class="bn-file-block-content-wrapper"></div>
        </div>
        <div id="root">
          <div id="inside" data-content-type="audio" data-url="https://example.com/inside.mp3" data-name="inside.mp3">
            <div class="bn-file-block-content-wrapper"></div>
          </div>
        </div>
      </main>
    `;

    const root = document.getElementById('root');
    if (!root) {
      throw new Error('missing root');
    }

    const cleanup = wrapMediaWithLink(root);

    const inside = document.getElementById('inside');
    const outside = document.getElementById('outside');

    expect(inside?.firstElementChild?.shadowRoot?.textContent).toContain(
      'inside.mp3',
    );
    expect(outside?.firstElementChild?.shadowRoot).toBeNull();

    cleanup();

    expect(inside?.firstElementChild?.shadowRoot).toBeNull();
  });

  test('wraps interlinks only inside the provided root', () => {
    document.body.innerHTML = `
      <main>
        <span class="--docs--interlinking-link-inline-content" data-href="https://example.com/outside">outside</span>
        <div id="root">
          <span class="--docs--interlinking-link-inline-content" data-href="https://example.com/inside">inside</span>
        </div>
      </main>
    `;

    const root = document.getElementById('root');
    if (!root) {
      throw new Error('missing root');
    }

    const cleanup = wrapInterlinksWithAnchor(root);

    expect(root.querySelector('a[data-print-link]')?.textContent).toBe(
      'inside',
    );
    expect(document.querySelectorAll('a[data-print-link]')).toHaveLength(1);

    cleanup();

    expect(document.querySelectorAll('a[data-print-link]')).toHaveLength(0);
  });
});

describe('print stylesheet', () => {
  test('takes the blend mode off the comment mark, not only its colours', () => {
    // Gecko cannot express a blended run in PDF and falls back to a bitmap of
    // it. Hiding the highlight while leaving mix-blend-mode in place turned
    // every commented sentence into a 72 dpi image in the exported file.
    const rule =
      PRINT_ONLY_CONTENT_CSS.split('.bn-thread-mark')[1]?.split('}')[0];

    expect(rule).toContain('mix-blend-mode: normal !important');
    expect(rule).toContain('background-color: transparent !important');
  });
});
