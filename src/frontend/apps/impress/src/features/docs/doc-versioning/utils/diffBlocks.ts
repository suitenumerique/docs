import { diffWords } from 'diff';

import { DiffBlock, DiffType, InlineContentDiff } from '../types';

// Use loose types to avoid BlockNote generic type parameters
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = any;
type AnyInlineContent = { type: string; text?: string; [key: string]: unknown };

/**
 * Flatten an array of BlockNote InlineContent items to a plain text string.
 */
function inlineContentToText(content: AnyInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      return '';
    })
    .join('');
}

/**
 * Compare inline content of two blocks and produce a word-level diff.
 */
function diffInlineContent(
  baseContent: AnyInlineContent[],
  targetContent: AnyInlineContent[],
): InlineContentDiff[] {
  const baseText = inlineContentToText(baseContent);
  const targetText = inlineContentToText(targetContent);

  if (baseText === targetText) {
    return [];
  }

  const changes = diffWords(baseText, targetText);
  const result: InlineContentDiff[] = [];

  for (const change of changes) {
    if (!change.value) {
      continue;
    }

    let diffType: DiffType = 'unchanged';
    if (change.added) {
      diffType = 'added';
    } else if (change.removed) {
      diffType = 'removed';
    }

    result.push({
      diffType,
      text: change.value,
    });
  }

  return result;
}

/**
 * Deeply compare two objects for equality.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}

/**
 * Check whether two blocks have the same type and props.
 */
function blocksStructurallyEqual(a: AnyBlock, b: AnyBlock): boolean {
  return a.type === b.type && deepEqual(a.props, b.props);
}

/**
 * Check whether the inline content arrays of two blocks are identical.
 */
function blocksContentEqual(a: AnyBlock, b: AnyBlock): boolean {
  const aContent = a.content as AnyInlineContent[] | undefined;
  const bContent = b.content as AnyInlineContent[] | undefined;

  if (!aContent && !bContent) {
    return true;
  }
  if (!aContent || !bContent) {
    return false;
  }

  return inlineContentToText(aContent) === inlineContentToText(bContent);
}

/**
 * Compute a diff between two arrays of BlockNote blocks.
 *
 * Matches blocks by their stable IDs. Unmatched blocks are detected
 * as added or removed. Modified blocks include an inline content diff.
 */
export function diffBlocks(
  baseBlocks: AnyBlock[],
  targetBlocks: AnyBlock[],
): DiffBlock[] {
  const baseMap = new Map<string, { block: AnyBlock; index: number }>();
  baseBlocks.forEach((block, index) => {
    baseMap.set(block.id, { block, index });
  });

  const matchedBaseIds = new Set<string>();
  const result: DiffBlock[] = [];

  // Walk through target blocks, matching against base by ID
  for (const targetBlock of targetBlocks) {
    const baseEntry = baseMap.get(targetBlock.id);

    if (!baseEntry) {
      // Block exists in target but not in base: added
      result.push({
        diffType: 'added',
        block: targetBlock,
        childrenDiff: targetBlock.children?.length
          ? diffBlocks([], targetBlock.children)
          : undefined,
      });
      continue;
    }

    matchedBaseIds.add(targetBlock.id);
    const baseBlock = baseEntry.block;

    const structurallyEqual = blocksStructurallyEqual(baseBlock, targetBlock);
    const contentEqual = blocksContentEqual(baseBlock, targetBlock);
    const childrenEqual = deepEqual(baseBlock.children, targetBlock.children);

    if (structurallyEqual && contentEqual && childrenEqual) {
      result.push({
        diffType: 'unchanged',
        block: targetBlock,
      });
      continue;
    }

    // Block was modified
    const baseContent = baseBlock.content as AnyInlineContent[] | undefined;
    const targetContent = targetBlock.content as AnyInlineContent[] | undefined;
    const contentDiff =
      baseContent && targetContent && !contentEqual
        ? diffInlineContent(baseContent, targetContent)
        : undefined;

    const childrenDiff =
      !childrenEqual && (baseBlock.children || targetBlock.children)
        ? diffBlocks(baseBlock.children || [], targetBlock.children || [])
        : undefined;

    result.push({
      diffType: 'modified',
      block: targetBlock,
      contentDiff: contentDiff?.length ? contentDiff : undefined,
      childrenDiff,
      propsChanged: !structurallyEqual,
    });
  }

  // Any base blocks not matched in target are removed.
  // Insert them at their original relative position.
  const removedBlocks: { block: AnyBlock; originalIndex: number }[] = [];
  baseMap.forEach((entry, id) => {
    if (!matchedBaseIds.has(id)) {
      removedBlocks.push({ block: entry.block, originalIndex: entry.index });
    }
  });

  // Sort removed blocks by original index to maintain order
  removedBlocks.sort((a, b) => a.originalIndex - b.originalIndex);

  // Insert removed blocks into the result at appropriate positions
  for (const { block } of removedBlocks) {
    result.push({
      diffType: 'removed',
      block,
      childrenDiff: block.children?.length
        ? diffBlocks(block.children, [])
        : undefined,
    });
  }

  return result;
}
