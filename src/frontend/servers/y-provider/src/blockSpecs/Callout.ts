import { createBlockSpec, defaultProps } from '@blocknote/core';

// Must stay in sync with the frontend CalloutBlock propSchema
// (custom-blocks/CalloutBlock.tsx).
const calloutPropSchema = {
  textAlignment: defaultProps.textAlignment,
  backgroundColor: { default: 'default' as const },
  emoji: { default: '💡' as const },
} as const;

const calloutConfig = {
  type: 'callout' as const,
  propSchema: calloutPropSchema,
  content: 'inline' as const,
};

export const CalloutBlock = createBlockSpec(calloutConfig, {
  render: (block) => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-type', 'callout');
    dom.setAttribute('data-emoji', block.props.emoji);
    if (block.props.backgroundColor !== 'default') {
      dom.setAttribute('data-background-color', block.props.backgroundColor);
    }
    const contentDOM = document.createElement('p');
    dom.appendChild(contentDOM);
    return { dom, contentDOM };
  },
  toExternalHTML: (block) => {
    const dom = document.createElement('aside');
    dom.setAttribute('role', 'note');
    dom.setAttribute('data-emoji', block.props.emoji);
    if (block.props.backgroundColor !== 'default') {
      dom.setAttribute('data-background-color', block.props.backgroundColor);
    }
    // The emoji lives *inside* contentDOM so rehype-remark (markdown export)
    // sees a single text-bearing child and doesn't drop the body text.
    // BlockNote appends inline content to contentDOM, so the emoji stays first.
    // The data-emoji marker lets downstream parsers strip the duplicated emoji
    // when reading the callout back (the canonical emoji is on the <aside>).
    const contentDOM = document.createElement('p');
    const emoji = document.createElement('span');
    emoji.setAttribute('aria-hidden', 'true');
    emoji.setAttribute('data-emoji', block.props.emoji);
    emoji.textContent = `${block.props.emoji} `;
    contentDOM.appendChild(emoji);
    dom.appendChild(contentDOM);
    return { dom, contentDOM };
  },
});
