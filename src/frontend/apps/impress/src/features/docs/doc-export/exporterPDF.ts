import {
  Block,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import { PDFExporter, strLit } from '@blocknote/xl-pdf-exporter';

import { tokens } from '@/cunningham';

/**
 * Font sizes of the headings in the editor (see `DocsEditorStyle`), in rem,
 * from level 1 to 6.
 */
const HEADING_SIZES_REM = [1.875, 1.5, 1.25, 1.125, 1, 0.875];

/**
 * Color of the links in the editor. The PDF page is always white, so the
 * light theme is used whatever the theme of the user.
 */
const LINK_COLOR = tokens.themes.default.globals.colors['gray-600'];

/**
 * Typst rules aligning the export on the style of the editor, where the
 * BlockNote preamble follows the default BlockNote style.
 */
export const getPdfDocsStyleRules = (baseFontSize: number) =>
  [
    ...HEADING_SIZES_REM.map(
      (size, index) =>
        `#show heading.where(level: ${index + 1}): set text(size: ${size * baseFontSize}pt)`,
    ),
    `#show link: set text(fill: rgb(${strLit(LINK_COLOR)}))`,
    `#show link: underline`,
  ].join('\n');

/**
 * The BlockNote preamble cannot be customized: the Docs rules are placed at
 * the start of the body, right after it, so that they override it.
 */
export class DocsPDFExporter<
  B extends BlockSchema,
  S extends StyleSchema,
  I extends InlineContentSchema,
> extends PDFExporter<B, S, I> {
  public override async transformBlocks(
    blocks: Block<B, I, S>[],
    nestingLevel = 0,
  ): Promise<string[]> {
    const markups = await super.transformBlocks(blocks, nestingLevel);

    // The nested blocks are transformed at a deeper level.
    if (nestingLevel > 0) {
      return markups;
    }

    return [getPdfDocsStyleRules(this.options.fontSize), ...markups];
  }
}
