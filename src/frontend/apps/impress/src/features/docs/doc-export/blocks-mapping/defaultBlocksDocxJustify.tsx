import { CheckBox, Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

import { blockNoteDocxBlockPropsToStyles } from './blockNoteDocxBlockProps';

/** Default-schema DOCX blocks with correct `justify` → `both` (see blockNoteDocxBlockProps). */

export const blockMappingParagraphDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['paragraph'] =
  (block, exporter) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: exporter.transformInlineContent(block.content),
    });

export const blockMappingHeadingDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['heading'] =
  (block, exporter) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: exporter.transformInlineContent(block.content),
      heading: `Heading${block.props.level as 1 | 2 | 3 | 4 | 5 | 6}`,
    });

export const blockMappingBulletListItemDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['bulletListItem'] =
  (block, exporter, nestingLevel) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: exporter.transformInlineContent(block.content),
      numbering: {
        reference: 'blocknote-bullet-list',
        level: nestingLevel,
      },
    });

export const blockMappingNumberedListItemDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['numberedListItem'] =
  (block, exporter, nestingLevel) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: exporter.transformInlineContent(block.content),
      numbering: {
        reference: 'blocknote-numbered-list',
        level: nestingLevel,
      },
    });

export const blockMappingToggleListItemDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['toggleListItem'] =
  (block, exporter) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: [
        new TextRun({
          children: ['> '],
        }),
        ...exporter.transformInlineContent(block.content),
      ],
    });

export const blockMappingCheckListItemDocxJustifyBoth: DocsExporterDocx['mappings']['blockMapping']['checkListItem'] =
  (block, exporter) =>
    new Paragraph({
      ...blockNoteDocxBlockPropsToStyles(block.props, exporter.options.colors),
      children: [
        new CheckBox({ checked: block.props.checked }),
        new TextRun({
          children: [' '],
        }),
        ...exporter.transformInlineContent(block.content),
      ],
    });
