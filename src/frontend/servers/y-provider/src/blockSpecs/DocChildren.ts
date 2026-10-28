import { createBlockSpec } from '@blocknote/core';

// Must stay in sync with the frontend DocChildrenBlock
// (custom-blocks/DocChildrenBlock.tsx).
const docChildrenConfig = {
  type: 'docChildren' as const,
  propSchema: {},
  content: 'none' as const,
};

// Lists the sub-docs of the doc, which the editor fetches when it renders the
// block. Conversion only has the document, not its sub-docs, so the block
// renders as an empty marker: it round-trips in JSON and leaves nothing in
// HTML or Markdown.
export const DocChildrenBlock = createBlockSpec(docChildrenConfig, {
  render: () => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-type', 'docChildren');
    return { dom };
  },
  toExternalHTML: () => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-type', 'docChildren');
    return { dom };
  },
});
