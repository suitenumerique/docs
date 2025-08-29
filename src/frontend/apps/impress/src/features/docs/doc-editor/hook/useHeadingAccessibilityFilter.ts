import { getDefaultReactSlashMenuItems } from '@blocknote/react';

import { DocsBlockNoteEditor } from '../types';

export const useHeadingAccessibilityFilter = () => {
  // function to extract heading level from menu item
  const getHeadingLevel = (
    item: ReturnType<typeof getDefaultReactSlashMenuItems>[0],
  ): number => {
    const title = item.title?.toLowerCase() || '';
    const aliases = item.aliases || [];
    const HEADING_2 = 'heading 2';
    const HEADING_3 = 'heading 3';
    const TITLE_2 = 'titre 2';
    const TITLE_3 = 'titre 3';

    if (
      title.includes(HEADING_2) ||
      title.includes(TITLE_2) ||
      aliases.some(
        (alias: string) => alias.includes(HEADING_2) || alias.includes(TITLE_2),
      )
    ) {
      return 2;
    }

    if (
      title.includes(HEADING_3) ||
      title.includes(TITLE_3) ||
      aliases.some(
        (alias: string) => alias.includes(HEADING_3) || alias.includes(TITLE_3),
      )
    ) {
      return 3;
    }

    return 1;
  };

  // function to check if item is a heading
  const isHeadingItem = (
    item: ReturnType<typeof getDefaultReactSlashMenuItems>[0],
  ): boolean => {
    return item.onItemClick?.toString().includes('heading');
  };

  const filterHeadingItemsByAccessibility = (
    items: ReturnType<typeof getDefaultReactSlashMenuItems>,
    editor: DocsBlockNoteEditor,
  ) => {
    const existingLevels = editor.document
      .filter((block) => block.type === 'heading')
      .map((block) => (block.props as { level: number }).level);

    const hasH1 = existingLevels.includes(1);

    if (existingLevels.length === 0) {
      return items.filter(
        (item) => !isHeadingItem(item) || getHeadingLevel(item) === 1,
      );
    }

    const maxLevel = Math.max(...existingLevels);
    const minLevel = Math.min(...existingLevels);

    return items.filter((item) => {
      if (!isHeadingItem(item)) {
        return true;
      }

      const headingLevel = getHeadingLevel(item);

      // Never allow h1 if one already exists >> accessibility tells that we can only have one h1 per document
      if (headingLevel === 1 && hasH1) {
        return false;
      }

      return (
        headingLevel === maxLevel ||
        headingLevel === maxLevel + 1 ||
        (headingLevel === minLevel - 1 && minLevel > 1)
      );
    });
  };

  return { filterHeadingItemsByAccessibility };
};
