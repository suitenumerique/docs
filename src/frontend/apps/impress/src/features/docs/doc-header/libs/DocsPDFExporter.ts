import { Block, DefaultProps, ExporterOptions } from '@blocknote/core';
import {
  PDFExporter,
  pdfDefaultSchemaMappings,
} from '@blocknote/xl-pdf-exporter';
import { Font } from '@react-pdf/renderer';

import {
  DocsBlockNoteSchema,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '@/features/docs/doc-editor';

type Options = ExporterOptions & {
  emojiSource: false | ReturnType<typeof Font.getEmojiSource>;
};

type DocsDefaultProps = DefaultProps & {
  level?: number;
};

export class DocsPDFExporter extends PDFExporter<
  DocsBlockSchema,
  DocsStyleSchema,
  DocsInlineContentSchema
> {
  constructor(
    protected readonly schemaMappings: DocsBlockNoteSchema,
    options?: Partial<Options>,
  ) {
    super(schemaMappings, pdfDefaultSchemaMappings, options);
  }

  /**
   * Breaklines are not displayed in PDFs, by adding a space we ensure that the line is not ignored
   * @param blocks
   * @param nestingLevel
   * @returns
   */
  public transformBlocks(
    blocks: Block<DocsBlockSchema, DocsInlineContentSchema, DocsStyleSchema>[], // Or BlockFromConfig<B[keyof B], I, S>?
    nestingLevel?: number,
  ) {
    blocks.forEach((block) => {
      if (Array.isArray(block.content)) {
        block.content.forEach((content) => {
          if (content.type === 'text' && !content.text) {
            content.text = ' ';
          }
        });

        if (!block.content.length) {
          block.content.push({
            styles: {},
            text: ' ',
            type: 'text',
          });
        }
      }
    });

    return super.transformBlocks(blocks, nestingLevel);
  }

  /**
   * Override the method to add our custom styles
   * @param props
   * @returns
   */
  public blocknoteDefaultPropsToReactPDFStyle(
    props: Partial<DocsDefaultProps>,
  ) {
    let styles = super.blocknoteDefaultPropsToReactPDFStyle(props);

    // Add margin to headings
    if (props.level) {
      styles = {
        marginTop: 15,
        marginBottom: 15,
        ...styles,
      };
    }

    return styles;
  }
}
