import { Fragment } from 'react';
import { css } from 'styled-components';

import { Box, Text } from '@/components';

import { DiffBlock, DiffType, InlineContentDiff } from '../types';

const diffColors: Record<DiffType, string> = {
  added: 'rgba(46, 160, 67, 0.15)',
  removed: 'rgba(248, 81, 73, 0.15)',
  modified: 'rgba(227, 179, 65, 0.08)',
  unchanged: 'transparent',
};

const DiffInlineContent = ({ parts }: { parts: InlineContentDiff[] }) => {
  return (
    <>
      {parts.map((part, i) => {
        if (part.diffType === 'added') {
          return (
            <span
              key={i}
              style={{
                backgroundColor: 'rgba(46, 160, 67, 0.3)',
                borderRadius: '2px',
              }}
            >
              {part.text}
            </span>
          );
        }
        if (part.diffType === 'removed') {
          return (
            <span
              key={i}
              style={{
                backgroundColor: 'rgba(248, 81, 73, 0.3)',
                textDecoration: 'line-through',
                opacity: 0.7,
                borderRadius: '2px',
              }}
            >
              {part.text}
            </span>
          );
        }
        return <Fragment key={i}>{part.text}</Fragment>;
      })}
    </>
  );
};

const blockTypeToTag = (type: string): keyof React.JSX.IntrinsicElements => {
  switch (type) {
    case 'heading':
      return 'h2';
    case 'bulletListItem':
      return 'li';
    case 'numberedListItem':
      return 'li';
    default:
      return 'div';
  }
};

const blockTypeToStyle = (
  block: DiffBlock['block'],
): React.CSSProperties | undefined => {
  const props = block.props as Record<string, unknown> | undefined;
  if (!props) {
    return undefined;
  }

  const style: React.CSSProperties = {};

  if (block.type === 'heading') {
    const level = (props.level as number) || 2;
    const sizes: Record<number, string> = { 1: '2em', 2: '1.5em', 3: '1.17em' };
    style.fontSize = sizes[level] || '1em';
    style.fontWeight = 'bold';
    style.margin = '0.5em 0';
  }

  if (props.textAlignment && props.textAlignment !== 'left') {
    style.textAlign = props.textAlignment as React.CSSProperties['textAlign'];
  }

  return Object.keys(style).length > 0 ? style : undefined;
};

interface DiffBlockItemProps {
  diffBlock: DiffBlock;
}

const DiffBlockItem = ({ diffBlock }: DiffBlockItemProps) => {
  const { diffType, block, contentDiff, childrenDiff } = diffBlock;

  const Tag = blockTypeToTag(block.type);
  const typeStyle = blockTypeToStyle(block);

  const isListItem = Tag === 'li';
  const listWrapper = block.type === 'numberedListItem' ? 'ol' : 'ul';

  const blockContent = (() => {
    // Use inline diff if available
    if (contentDiff && contentDiff.length > 0) {
      return <DiffInlineContent parts={contentDiff} />;
    }

    // Render plain text content from the block
    const content = block.content as
      | Array<{ type: string; text?: string }>
      | undefined;
    if (content && Array.isArray(content)) {
      return (
        <>
          {content.map((item, i) => {
            if (item.type === 'text' && item.text) {
              return <Fragment key={i}>{item.text}</Fragment>;
            }
            return null;
          })}
        </>
      );
    }

    // For blocks without text content, show a type indicator
    const blockType = block.type as string;
    if (blockType === 'image') {
      const props = block.props as Record<string, unknown>;
      return (
        <Text $size="sm" $theme="greyscale">
          [{blockType}: {(props.name as string) || (props.url as string) || 'image'}]
        </Text>
      );
    }

    if (blockType === 'callout') {
      const props = block.props as Record<string, unknown>;
      return (
        <Text $size="sm">
          {(props.emoji as string) || ''} [{blockType}]
        </Text>
      );
    }

    return null;
  })();

  const diffBg = diffColors[diffType];
  const isRemoved = diffType === 'removed';

  const innerElement = (
    <Tag
      style={{
        ...typeStyle,
        ...(isRemoved
          ? { textDecoration: 'line-through', opacity: 0.6 }
          : undefined),
      }}
    >
      {blockContent}
    </Tag>
  );

  const wrappedElement = isListItem ? (
    <Box as={listWrapper as 'ul' | 'ol'} $padding="none" $margin="none">
      {innerElement}
    </Box>
  ) : (
    innerElement
  );

  return (
    <Box
      $css={css`
        background: ${diffBg};
        border-left: ${diffType !== 'unchanged' ? `3px solid ${diffType === 'added' ? 'rgba(46, 160, 67, 0.6)' : diffType === 'removed' ? 'rgba(248, 81, 73, 0.6)' : 'rgba(227, 179, 65, 0.6)'}` : 'none'};
        padding: 2px 8px;
        margin: 1px 0;
        border-radius: 2px;
      `}
    >
      {wrappedElement}
      {childrenDiff && childrenDiff.length > 0 && (
        <Box $margin={{ left: 'base' }}>
          <DiffBlockList blocks={childrenDiff} />
        </Box>
      )}
    </Box>
  );
};

interface DiffBlockListProps {
  blocks: DiffBlock[];
}

const DiffBlockList = ({ blocks }: DiffBlockListProps) => {
  return (
    <>
      {blocks.map((diffBlock, index) => (
        <DiffBlockItem key={diffBlock.block.id || index} diffBlock={diffBlock} />
      ))}
    </>
  );
};

interface DiffBlockRendererProps {
  diffBlocks: DiffBlock[];
}

export const DiffBlockRenderer = ({ diffBlocks }: DiffBlockRendererProps) => {
  return (
    <Box
      $padding={{ horizontal: 'base', vertical: 'sm' }}
      className="--docs--diff-renderer"
      $css={css`
        font-family: var(--c--foundations--font--families--base);
        font-size: 1rem;
        line-height: 1.6;
      `}
    >
      <DiffBlockList blocks={diffBlocks} />
    </Box>
  );
};
