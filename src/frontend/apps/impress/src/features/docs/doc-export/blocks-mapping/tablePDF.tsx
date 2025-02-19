import { TD, TH, TR, Table } from '@ag-media/react-pdf-table';
import { View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingTablePDF: DocsExporterPDF['mappings']['blockMapping']['table'] =
  (block, exporter) => {
    return (
      <Table>
        {block.content.rows.map((row, index) => {
          if (index === 0) {
            return (
              <TH key={index}>
                {row.cells.map((cell, index) => {
                  // Make empty cells are rendered.
                  if (cell.length === 0) {
                    cell.push({
                      styles: {},
                      text: ' ',
                      type: 'text',
                    });
                  }
                  return (
                    <TD key={index}>{exporter.transformInlineContent(cell)}</TD>
                  );
                })}
              </TH>
            );
          }
          return (
            <TR key={index}>
              {row.cells.map((cell, index) => {
                // Make empty cells are rendered.
                if (cell.length === 0) {
                  cell.push({
                    styles: {},
                    text: ' ',
                    type: 'text',
                  });
                }
                return (
                  <TD key={index}>
                    <View>{exporter.transformInlineContent(cell)}</View>
                  </TD>
                );
              })}
            </TR>
          );
        })}
      </Table>
    );
  };
