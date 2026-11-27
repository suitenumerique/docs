import {
  BlockNoteEditor,
  DefaultBlockSchema,
  DefaultInlineContentSchema,
  DefaultStyleSchema,
} from '@blocknote/core';
import {
  DOCXExporter,
  docxDefaultSchemaMappings,
} from '@blocknote/xl-docx-exporter';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { getDocxDocsSchemaMappings } from '../mappingDocx';

// Font loading requires browser asset URLs; table serialization needs no fonts.
class TableTestExporter extends DOCXExporter<
  DefaultBlockSchema,
  DefaultStyleSchema,
  DefaultInlineContentSchema
> {
  protected async getFonts() {
    return [];
  }
}

async function exportXml(
  editor: ReturnType<typeof BlockNoteEditor.create>,
  blocks = editor.document,
) {
  const exporter = new TableTestExporter(
    editor.schema,
    getDocxDocsSchemaMappings(new Map(), 'Image unavailable'),
  );
  const document = await exporter.toDocxJsDocument(blocks);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  return new DOMParser().parseFromString(
    await zip.file('word/document.xml')!.async('string'),
    'application/xml',
  );
}

const tableContent = {
  type: 'tableContent' as const,
  columnWidths: [Number.NaN, 120],
  rows: [{ cells: [['First cell'], ['Second cell']] }],
};

describe('DOCX table mapping', () => {
  it('uses the installed function mapping supported by the main wrapper', () => {
    expect(typeof docxDefaultSchemaMappings.blockMapping.table).toBe(
      'function',
    );
  });

  it('exports NaN column widths without invalid XML values', async () => {
    const editor = BlockNoteEditor.create({
      initialContent: [{ type: 'table', content: tableContent }],
    });

    const blocks = editor.document;
    const table = blocks[0];
    if (table.type !== 'table') {
      throw new Error('Expected a table fixture');
    }
    // The editor normalizes widths; exercise legacy export input directly.
    table.content.columnWidths = [Number.NaN, 120];
    const xml = await exportXml(editor, blocks);

    expect(table.content.columnWidths).toEqual([undefined, 120]);
    expect(xml.getElementsByTagName('w:tbl')).toHaveLength(1);
    expect(xml.documentElement.textContent).toContain('First cell');
    expect(xml.documentElement.textContent).toContain('Second cell');
    expect(new XMLSerializer().serializeToString(xml)).not.toContain('NaN');
    expect(xml.getElementsByTagName('w:gridCol')).toHaveLength(2);
  });

  it('preserves a nested table and the table’s own children in document order', async () => {
    const editor = BlockNoteEditor.create({
      initialContent: [
        {
          type: 'bulletListItem',
          content: 'Parent item',
          children: [
            {
              type: 'table',
              content: tableContent,
              children: [{ type: 'paragraph', content: 'Child of table' }],
            },
            { type: 'paragraph', content: 'Following sibling' },
          ],
        },
      ],
    });

    const xml = await exportXml(editor);

    expect(xml.getElementsByTagName('w:tbl')).toHaveLength(1);
    const text = xml.documentElement.textContent;
    for (const label of [
      'Parent item',
      'First cell',
      'Second cell',
      'Child of table',
      'Following sibling',
    ]) {
      expect(text.split(label)).toHaveLength(2);
    }
    expect(text.indexOf('Parent item')).toBeLessThan(
      text.indexOf('First cell'),
    );
    expect(text.indexOf('Second cell')).toBeLessThan(
      text.indexOf('Child of table'),
    );
    expect(text.indexOf('Child of table')).toBeLessThan(
      text.indexOf('Following sibling'),
    );
  });
});
