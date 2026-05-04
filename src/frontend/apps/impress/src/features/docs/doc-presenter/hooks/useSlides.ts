import { useMemo } from 'react';

type Block = {
  type: string;
  content?: unknown;
  children?: Block[];
};

const TEXT_BEARING_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
]);

const extractText = (content: unknown): string => {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(extractText).join('');
  }
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === 'string') {
      return obj.text;
    }
    if ('content' in obj) {
      return extractText(obj.content);
    }
  }
  return '';
};

export const isEmptyBlock = (block: Block): boolean => {
  if (!TEXT_BEARING_TYPES.has(block.type)) {
    return false;
  }
  if (block.children && block.children.length > 0) {
    return false;
  }
  return extractText(block.content).trim() === '';
};

/**
 * Split a flat list of top-level blocks into slide groups.
 *
 * - Each `divider` block separates two slides; the divider itself is dropped.
 * - Empty text-bearing blocks (paragraph, heading, ...) are filtered out.
 * - Groups that are empty after filtering are removed entirely.
 * - The returned array is never empty: an empty doc yields one empty group.
 */
export const splitBlocksIntoSlides = <T extends Block>(blocks: T[]): T[][] => {
  const groups: T[][] = [];
  let current: T[] = [];

  for (const block of blocks) {
    if (block.type === 'divider') {
      groups.push(current);
      current = [];
      continue;
    }
    current.push(block);
  }
  groups.push(current);

  const cleaned = groups
    .map((group) => group.filter((b) => !isEmptyBlock(b)))
    .filter((group) => group.length > 0);

  return cleaned.length > 0 ? cleaned : [[]];
};

export const useSlides = <T extends Block>(blocks: T[]): T[][] => {
  return useMemo(() => splitBlocksIntoSlides(blocks), [blocks]);
};
