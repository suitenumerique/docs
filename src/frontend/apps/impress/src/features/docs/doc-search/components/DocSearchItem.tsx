import Link from 'next/link';
import { MouseEvent } from 'react';

import ArrowIcon from '@/assets/icons/ui-kit/enter.svg';
import { Box, Icon } from '@/components';
import { QuickSearchItemContent } from '@/components/quick-search/';
import { SimpleDocItem } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { DocSearch } from '../api/useSearchDocs';
import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';

type DocSearchItemProps = {
  doc: DocSearch;
  onClose?: () => void;
};

export const DocSearchItem = ({ doc, onClose }: DocSearchItemProps) => {
  const { isDesktop } = useResponsiveStore();
  const { filter } = useDocSearchFilterStore();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      // Modifier click or middle-click: let the browser open in a new tab
      // natively via the <a> tag. Stop propagation so cmdk's onSelect
      // does not also navigate in the current tab.
      e.stopPropagation();
      onClose?.();
    } else {
      // Normal click: prevent the <a> default navigation and let cmdk's
      // onSelect handle it (router.push + modal close).
      e.preventDefault();
    }
  };

  return (
    <Link
      href={`/docs/${doc.id}`}
      onClick={handleClick}
      onAuxClick={handleClick}
      style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
    >
      <Box
        data-testid={`doc-search-item-${doc.id}`}
        $width="100%"
        className="--docs--doc-search-item"
      >
        <QuickSearchItemContent
          left={
            <Box $direction="row" $align="center" $gap="10px" $width="100%">
              <Box $flex={isDesktop ? 9 : 1}>
                <SimpleDocItem
                  doc={doc}
                  showDate
                  breadcrumb={filter === 'all' ? doc.parent?.title : undefined}
                />
              </Box>
            </Box>
          }
          right={
            <Icon
              $padding={{ horizontal: '3xs' }}
              $theme="brand"
              $variation="secondary"
              icon={<ArrowIcon width={16} height={16} aria-hidden="true" />}
            />
          }
        />
      </Box>
    </Link>
  );
};
