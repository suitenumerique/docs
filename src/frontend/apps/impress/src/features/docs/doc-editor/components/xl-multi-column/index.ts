/**
 * To import XL modules you must import from the index file.
 * This is to ensure that the XL modules are only loaded when
 * the application is not published as MIT.
 */
import type {
  BlockNoteSchema,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import * as XLMultiColumn from '@blocknote/xl-multi-column';

/**
 * Custom withMultiColumn that strips the MultiColumnDropHandlerExtension
 * from ColumnBlock.
 * This prevents dragging a block onto another block from
 * automatically creating a multi-column layout.
 * @param schema
 * @returns
 */
const withMultiColumnNoDropHandler = <
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(
  schema: BlockNoteSchema<B, I, S>,
) => {
  const ColumnBlockNoDropHandler = {
    ...XLMultiColumn.ColumnBlock,
    extensions: [],
  };

  return schema.extend({
    blockSpecs: {
      column: ColumnBlockNoDropHandler,
      columnList: XLMultiColumn.ColumnListBlock,
    },
  });
};

type ModulesXL =
  | (Omit<typeof XLMultiColumn, 'withMultiColumn'> & {
      withMultiColumn: typeof withMultiColumnNoDropHandler;
    })
  | undefined;

let modulesXL: ModulesXL = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesXL = {
    ...XLMultiColumn,
    withMultiColumn: withMultiColumnNoDropHandler,
  };
}

export default modulesXL;
