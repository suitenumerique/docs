import { describe, expect, it } from 'vitest';

import { withMermaidFontFamily } from '../blocks-mapping/diagramPDF';

describe('withMermaidFontFamily', () => {
  it('lays the diagram out with the font of the export', () => {
    expect(
      withMermaidFontFamily('graph TD; A --> B', '"Inter 18pt", sans-serif'),
    ).toBe(
      '%%{init: {"fontFamily":"\\"Inter 18pt\\", sans-serif","themeVariables":{"fontFamily":"\\"Inter 18pt\\", sans-serif"}}}%%\ngraph TD; A --> B',
    );
  });

  it('leaves a diagram starting with a frontmatter as it is', () => {
    const source = '---\ntitle: Flow\n---\ngraph TD; A --> B';

    expect(withMermaidFontFamily(source, '"Inter 18pt"')).toBe(source);
  });
});
