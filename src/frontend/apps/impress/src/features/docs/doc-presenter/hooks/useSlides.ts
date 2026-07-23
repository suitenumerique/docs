import { useMemo } from 'react';

import type { PresenterBlock } from '../types';

type SlideGroup<T extends PresenterBlock> = {
  blocks: T[];
  dividerId?: string;
  startsAfterDivider?: boolean;
};

// Extract text from a node's inline content for summarization or accessibility.
const extractInlineText = (content: PresenterBlock['content']): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((node) => {
      if (typeof node === 'string') {
        return node;
      }
      if (node && typeof node === 'object') {
        if ('text' in node && typeof node.text === 'string') {
          return node.text;
        }
        if ('content' in node && node.content !== undefined) {
          return extractInlineText(node.content);
        }
      }
      return '';
    })
    .join('');
};

const isEmptyParagraphBlock = (block: PresenterBlock): boolean =>
  block.type === 'paragraph' &&
  extractInlineText(block.content).trim().length === 0 &&
  (block.children ?? []).length === 0;

type TrimSide = 'leading' | 'trailing';

// Drop empty paragraph blocks from one end of the list. The opposite end and
// any non-empty block (content paragraphs, headings, custom blocks) are left
// untouched.
const trimEmptyParagraphs = <T extends PresenterBlock>(
  blocks: T[],
  side: TrimSide,
): T[] => {
  if (side === 'leading') {
    const firstContentIndex = blocks.findIndex(
      (block) => !isEmptyParagraphBlock(block),
    );

    return firstContentIndex === -1 ? [] : blocks.slice(firstContentIndex);
  }

  const reversedLastContentIndex = [...blocks]
    .reverse()
    .findIndex((block) => !isEmptyParagraphBlock(block));

  return reversedLastContentIndex === -1
    ? []
    : blocks.slice(0, blocks.length - reversedLastContentIndex);
};

// A divider carrying children is kept as the structural parent of the
// following slide; trim the empty paragraphs from the relevant end of its
// children. Returns null when nothing renderable remains, and the block
// unchanged when it is not such a structural divider or needs no trimming.
const trimStructuralDividerBoundary = <T extends PresenterBlock>(
  block: T,
  side: TrimSide,
): T | null => {
  if (block.type !== 'divider' || !Array.isArray(block.children)) {
    return block;
  }

  const children = trimEmptyParagraphs(block.children, side);
  if (children.length === 0) {
    return null;
  }

  if (children.length === block.children.length) {
    return block;
  }

  return { ...block, children };
};

const stripLeadingEmptyParagraphsAfterDivider = <T extends PresenterBlock>(
  group: SlideGroup<T>,
): SlideGroup<T> => {
  if (!group.startsAfterDivider) {
    return group;
  }

  const [firstBlock, ...remainingBlocks] = group.blocks;
  const firstRenderableBlock = firstBlock
    ? trimStructuralDividerBoundary(firstBlock, 'leading')
    : null;
  const blocks = firstRenderableBlock
    ? [firstRenderableBlock, ...remainingBlocks]
    : remainingBlocks;

  return {
    ...group,
    blocks: trimEmptyParagraphs(blocks, 'leading'),
  };
};

const stripTrailingEmptyParagraphsBeforeDivider = <T extends PresenterBlock>(
  blocks: T[],
): T[] => {
  const lastBlock = blocks[blocks.length - 1];
  const lastRenderableBlock = lastBlock
    ? trimStructuralDividerBoundary(lastBlock, 'trailing')
    : null;
  const trimmedBlocks = lastRenderableBlock
    ? [...blocks.slice(0, -1), lastRenderableBlock]
    : blocks.slice(0, -1);

  return trimEmptyParagraphs(trimmedBlocks, 'trailing');
};

const getRawSlideGroups = <T extends PresenterBlock>(
  blocks: T[],
  options: { stripBeforeDividers?: boolean } = {},
): SlideGroup<T>[] => {
  const groups: SlideGroup<T>[] = [{ blocks: [] }];
  let current = groups[0];

  for (const block of blocks) {
    if (block.type === 'divider') {
      if (options.stripBeforeDividers) {
        current.blocks = stripTrailingEmptyParagraphsBeforeDivider(
          current.blocks,
        );
      }
      current = {
        blocks:
          Array.isArray(block.children) && block.children.length > 0
            ? [block]
            : [],
        dividerId: block.id,
        startsAfterDivider: true,
      };
      groups.push(current);
      continue;
    }

    current.blocks.push(block);
  }

  return groups;
};

const getRenderedSlideGroups = <T extends PresenterBlock>(
  blocks: T[],
): SlideGroup<T>[] =>
  getRawSlideGroups(blocks, { stripBeforeDividers: true }).map(
    stripLeadingEmptyParagraphsAfterDivider,
  );

const hasBlockId = (blocks: PresenterBlock[], blockId: string): boolean =>
  blocks.some(
    (block) =>
      block.id === blockId || hasBlockId(block.children ?? [], blockId),
  );

/**
 * Split a flat list of top-level blocks into slide groups.
 *
 * - Each `divider` block separates two slides. Dividers without children are
 *   dropped.
 * - A divider with children is kept as a structural parent in the following
 *   slide so BlockNote can preserve the visual indentation line. The presenter
 *   hides the divider's own horizontal rule when rendering the slide.
 * - Empty paragraphs immediately before or after a divider are dropped so
 *   habitual spacing around slide breaks does not offset the slides. Empty
 *   paragraphs elsewhere are preserved as intentional spacing, and custom
 *   blocks (interlinks, embeds, ...) are kept verbatim.
 * - Groups with no blocks at all are removed (handles leading, trailing or
 *   consecutive dividers).
 * - The returned array is never empty: an empty doc yields one empty group.
 */
export const splitBlocksIntoSlides = <T extends PresenterBlock>(
  blocks: T[],
): T[][] => {
  const nonEmpty = getRenderedSlideGroups(blocks)
    .map((group) => group.blocks)
    .filter((group) => group.length > 0);

  return nonEmpty.length > 0 ? nonEmpty : [[]];
};

/**
 * Map a block id to the index of the rendered (non-empty) content slide it
 * belongs to. Accepts a regular block id, a block nested under a divider, or a
 * divider's own id. When the matching group is dropped at render time (e.g. an
 * empty slide), falls back to the closest rendered slide: the one directly
 * containing the block, else the following content slide, else the previous
 * one. Returns 0 when the block is absent (and as the ultimate fallback).
 */
export const getContentSlideIndexForBlock = <T extends PresenterBlock>(
  blocks: T[],
  blockId: string,
): number => {
  const rawGroups = getRawSlideGroups(blocks);
  const renderedGroups = getRenderedSlideGroups(blocks);
  const nonEmptyGroups = renderedGroups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => group.blocks.length > 0);

  const getClosestRenderedSlideIndex = (groupIndex: number) => {
    const directSlideIndex = nonEmptyGroups.findIndex(
      ({ index }) => index === groupIndex,
    );

    if (directSlideIndex !== -1) {
      return directSlideIndex;
    }

    const followingSlideIndex = nonEmptyGroups.findIndex(
      ({ index }) => index > groupIndex,
    );

    if (followingSlideIndex !== -1) {
      return followingSlideIndex;
    }

    const previousSlideIndex = nonEmptyGroups.findLastIndex(
      ({ index }) => index < groupIndex,
    );

    return previousSlideIndex !== -1 ? previousSlideIndex : 0;
  };

  const directGroupIndex = rawGroups.findIndex((group) =>
    hasBlockId(group.blocks, blockId),
  );

  if (directGroupIndex !== -1) {
    return getClosestRenderedSlideIndex(directGroupIndex);
  }

  const dividerGroupIndex = rawGroups.findIndex(
    (group) => group.dividerId === blockId,
  );

  if (dividerGroupIndex === -1) {
    return 0;
  }

  return getClosestRenderedSlideIndex(dividerGroupIndex);
};

/** Memoized {@link splitBlocksIntoSlides} for use during render. */
export const useSlides = <T extends PresenterBlock>(blocks: T[]): T[][] => {
  return useMemo(() => splitBlocksIntoSlides(blocks), [blocks]);
};

const getBlocksInReadingOrder = <T extends PresenterBlock>(
  blocks: T[],
): PresenterBlock[] => {
  return blocks.flatMap((block) => [
    block,
    ...getBlocksInReadingOrder(block.children ?? []),
  ]);
};

/** First heading text, or first block with text, for SR announcements. */
export const getSlideTitle = (blocks: PresenterBlock[]): string => {
  const blocksInReadingOrder = getBlocksInReadingOrder(blocks);
  const heading = blocksInReadingOrder.find(
    (block) => block.type === 'heading',
  );
  const source =
    heading ??
    blocksInReadingOrder.find(
      (block) => extractInlineText(block.content).trim().length > 0,
    );

  return source ? extractInlineText(source.content).trim() : '';
};
