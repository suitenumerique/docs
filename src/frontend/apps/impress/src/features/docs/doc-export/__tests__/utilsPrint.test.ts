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
  const printDeclarationsMatching = (element: Element) => {
    const styles = document.createElement('style');
    styles.textContent = PRINT_ONLY_CONTENT_CSS;
    document.head.appendChild(styles);

    const declarations = Array.from(styles.sheet?.cssRules ?? [])
      .filter((rule) => rule instanceof CSSMediaRule)
      .filter((rule) => rule.media.mediaText === 'print')
      .flatMap((rule) => Array.from(rule.cssRules))
      .filter((rule) => rule instanceof CSSStyleRule)
      .filter((rule) => element.matches(rule.selectorText))
      .map((rule) => rule.style);

    styles.remove();

    return declarations;
  };

  const declaredValues = (
    declarations: CSSStyleDeclaration[],
    property: string,
  ) =>
    declarations
      .map((declaration) => ({
        value: declaration.getPropertyValue(property),
        priority: declaration.getPropertyPriority(property),
      }))
      .filter(({ value }) => value !== '');

  test('takes the blend mode off the comment mark, not only its colours', () => {
    const mark = document.createElement('span');
    mark.className = 'bn-thread-mark';

    const declarations = printDeclarationsMatching(mark);

    expect(declaredValues(declarations, 'mix-blend-mode')).toEqual([
      { value: 'normal', priority: 'important' },
    ]);
    expect(declaredValues(declarations, 'background-color')).toEqual([
      { value: 'transparent', priority: 'important' },
    ]);
  });
});
