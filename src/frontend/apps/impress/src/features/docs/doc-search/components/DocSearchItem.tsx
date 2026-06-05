import ArrowIcon from '@/assets/icons/ui-kit/enter.svg';
import { Box, Icon } from '@/components';
import { QuickSearchItemContent } from '@/components/quick-search/';
import { SimpleDocItem } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { DocSearch } from '../api/useSearchDocs';
import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';

type DocSearchItemProps = {
  doc: DocSearch;
};

export const DocSearchItem = ({ doc }: DocSearchItemProps) => {
  const { isDesktop } = useResponsiveStore();
  const { filter } = useDocSearchFilterStore();

  return (
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
                isPinned={doc.is_favorite}
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
  );
};
