/**
 * We use mainly the Blocknotes code, mixed with @ag-media/react-pdf-table
 * to have a better Table support.
 * See:
 * https://github.com/TypeCellOS/BlockNote/blob/004c0bf720fe1415c497ad56449015c5f4dd7ba0/packages/xl-pdf-exporter/src/pdf/util/table/Table.tsx
 *
 * We succeded to manage the colspan, but rowspan is not supported yet.
 */

import { TD, TR, Table } from '@ag-media/react-pdf-table';
import { mapTableCell } from '@blocknote/core';
import { StyleSheet, Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';
const PIXELS_PER_POINT = 0.75;
const styles = StyleSheet.create({
  tableContainer: {
    border: '1px solid #ddd',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    display: 'flex',
  },
  cell: {
    paddingHorizontal: 5 * PIXELS_PER_POINT,
    paddingTop: 3 * PIXELS_PER_POINT,
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  headerCell: {
    fontWeight: 'bold',
  },
});

export const blockMappingTablePDF: DocsExporterPDF['mappings']['blockMapping']['table'] =
  (block, exporter) => {
    const { options } = exporter;
    const blockContent = block.content;

    // If headerRows is 1, then the first row is a header row
    const headerRows = new Array(blockContent.headerRows ?? 0).fill(
      true,
    ) as boolean[];
    // If headerCols is 1, then the first column is a header column
    const headerCols = new Array(blockContent.headerCols ?? 0).fill(
      true,
    ) as boolean[];

    /**
     * Calculate the table scale based on the column widths.
     */
    const columnWidths = blockContent.columnWidths.map((w) => w || 120);
    const fullWidth = 730;
    const totalWidth = Math.min(
      columnWidths.reduce((sum, w) => sum + w, 0),
      fullWidth,
    );
    const tableScale = (totalWidth * 100) / fullWidth;

    return (
      <Table style={[styles.tableContainer, { width: `${tableScale}%` }]}>
        {blockContent.rows.map((row, rowIndex) => {
          const isHeaderRow = headerRows[rowIndex];

          return (
            <TR key={rowIndex}>
              {row.cells.map((c, colIndex) => {
                const formatCell = mapTableCell(c);

                const isHeaderCol = headerCols[colIndex];

                const cell = formatCell.content;
                const cellProps = formatCell.props;

                // Make empty cells rendered.
                if (Array.isArray(cell) && cell.length === 0) {
                  cell.push({
                    styles: {},
                    text: ' ',
                    type: 'text',
                  });
                }

                const weight = columnWidths
                  .slice(colIndex, colIndex + (cellProps.colspan || 1))
                  .reduce((sum, w) => sum + w, 0);

                const flexCell = {
                  flex: `${weight} ${weight} 0%`,
                };

                const arrayStyle = [
                  isHeaderRow || isHeaderCol ? styles.headerCell : {},
                  flexCell,
                  {
                    color:
                      cellProps.textColor === 'default'
                        ? undefined
                        : options.colors[
                            cellProps.textColor as keyof typeof options.colors
                          ].text,
                    backgroundColor:
                      cellProps.backgroundColor === 'default'
                        ? undefined
                        : options.colors[
                            cellProps.backgroundColor as keyof typeof options.colors
                          ].background,
                    textAlign: cellProps.textAlignment,
                  },
                ];

                return (
                  <TD key={colIndex} style={arrayStyle}>
                    <Text style={styles.cell}>
                      {exporter.transformInlineContent(cell)}
                    </Text>
                  </TD>
                );
              })}
            </TR>
          );
        })}
      </Table>
    );
  };
