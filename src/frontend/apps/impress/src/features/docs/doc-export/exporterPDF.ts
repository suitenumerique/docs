import {
  Block,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import {
  PDFExporter,
  loadDefaultBodyFonts,
  strLit,
} from '@blocknote/xl-pdf-exporter';

import { tokens } from '@/cunningham';

/**
 * Faces of the first fonts of `loadDefaultBodyFonts`: the body font of the
 * export, in regular, italic, bold and bold italic.
 */
const BODY_FONT_FACES: FontFaceDescriptors[] = [
  { style: 'normal', weight: '400' },
  { style: 'italic', weight: '400' },
  { style: 'normal', weight: '700' },
  { style: 'italic', weight: '700' },
];

let bodyFontsInBrowser: Promise<void> | undefined;

/**
 * Mermaid lays the diagrams out in the browser, measuring their labels with
 * the body font of the export, which Typst then draws them with. Unknown to
 * the browser, this font would fall back to the sans-serif font of the OS:
 * the labels would not fit their boxes, and the export would depend on the
 * OS. It is registered in the browser with the very bytes Typst embeds.
 */
export const registerBodyFontsInBrowser = (fontFamily: string) => {
  if (typeof FontFace === 'undefined') {
    return Promise.resolve();
  }

  bodyFontsInBrowser ??= loadDefaultBodyFonts()
    .then(async (fonts) => {
      const faces = BODY_FONT_FACES.map(
        (descriptors, index) =>
          new FontFace(
            fontFamily,
            fonts[index] as Uint8Array<ArrayBuffer>,
            descriptors,
          ),
      );
      await Promise.all(faces.map((face) => face.load()));
      faces.forEach((face) => document.fonts.add(face));
    })
    .catch((error: unknown) => {
      // The diagrams are still exported, with the font of the OS
      console.warn('Failed to register the PDF fonts in the browser', error);
      bodyFontsInBrowser = undefined;
    });

  return bodyFontsInBrowser;
};

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

  public override async toPDF(
    ...args: Parameters<PDFExporter<B, S, I>['toPDF']>
  ) {
    await registerBodyFontsInBrowser(this.fontFamilies[0]);

    return super.toPDF(...args);
  }
}
