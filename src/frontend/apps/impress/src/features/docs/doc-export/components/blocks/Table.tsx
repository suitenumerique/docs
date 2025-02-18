import { TD, TH, TR, Table as TablePDF } from '@ag-media/react-pdf-table';
import {
  DefaultBlockSchema,
  Exporter,
  InlineContentSchema,
  StyleSchema,
  TableContent,
} from '@blocknote/core';
import { View } from '@react-pdf/renderer';
import { ReactNode } from 'react';

export const Table = (props: {
  data: TableContent<InlineContentSchema>;
  transformer: Exporter<
    DefaultBlockSchema,
    InlineContentSchema,
    StyleSchema,
    unknown,
    unknown,
    unknown,
    unknown
  >;
}) => {
  return (
    <TablePDF>
      {props.data.rows.map((row, index) => {
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
                  <TD key={index}>
                    {props.transformer.transformInlineContent(cell)}
                  </TD>
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
                  <View>
                    {
                      props.transformer.transformInlineContent(
                        cell,
                      ) as ReactNode
                    }
                  </View>
                </TD>
              );
            })}
          </TR>
        );
      })}
    </TablePDF>
  );
};
