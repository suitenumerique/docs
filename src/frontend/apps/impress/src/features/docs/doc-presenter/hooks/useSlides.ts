import { useMemo } from 'react';

type Block = {
  type: string;
  content?: unknown;
  children?: Block[];
};

/**
 * Split a flat list of top-level blocks into slide groups.
 *
 * - Each `divider` block separates two slides; the divider itself is dropped.
 * - Blocks are otherwise preserved verbatim — including empty paragraphs
 *   (intentional spacing) and custom blocks (interlinks, embeds, ...). The
 *   presenter renders whatever the editor holds; it does not second-guess
 *   the author's content.
 * - Groups with no blocks at all are removed (handles leading, trailing or
 *   consecutive dividers).
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

  const nonEmpty = groups.filter((group) => group.length > 0);

  return nonEmpty.length > 0 ? nonEmpty : [[]];
};

export const useSlides = <T extends Block>(blocks: T[]): T[][] => {
  return useMemo(() => splitBlocksIntoSlides(blocks), [blocks]);
};
