import { renderDiagramToSVG } from '@blocknote/diagram-block';
import { createDiagramBlockMapping } from '@blocknote/diagram-block/typst-exporter';
import { TypstExporter } from '@blocknote/xl-pdf-exporter';

import { DocsBlockMappingPDF } from '../types';

/**
 * Has Mermaid lay the diagram out with `fontFamily`, through an init
 * directive. A source starting with a frontmatter is left as it is: the
 * frontmatter must come first.
 */
export const withMermaidFontFamily = (source: string, fontFamily: string) =>
  source.trimStart().startsWith('---')
    ? source
    : `%%{init: ${JSON.stringify({
        fontFamily,
        themeVariables: { fontFamily },
      })}}%%\n${source}`;

/**
 * BlockNote has Mermaid lay the diagram out with Mermaid's default font, then
 * only declares the labels in the font of the export, which Typst draws them
 * with: the boxes are sized for another font, one that depends on the OS.
 * The layout is done with the font of the export instead, which
 * `DocsPDFExporter` registers in the browser.
 */
export const blockMappingDiagramPDF: DocsBlockMappingPDF<'diagram'> = (
  block,
  exporter,
) => {
  const fontFamily = `${(
    exporter as unknown as TypstExporter<never, never, never>
  ).fontFamilies
    .map((family) => `"${family}"`)
    .join(', ')}, sans-serif`;

  return createDiagramBlockMapping({
    renderDiagram: (source) =>
      renderDiagramToSVG(withMermaidFontFamily(source, fontFamily), {
        fontFamily,
      }),
  })(block, exporter);
};
