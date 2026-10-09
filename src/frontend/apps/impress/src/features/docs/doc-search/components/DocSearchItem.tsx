import { css } from 'styled-components';

import ArrowIcon from '@/assets/icons/ui-kit/enter.svg';
import { Box, Icon, StyledLink } from '@/components';
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
    <StyledLink
      data-testid={`doc-search-item-${doc.id}`}
      className="--docs--doc-search-item"
      href={`/docs/${doc.id}`}
      tabIndex={-1}
      $css={css`
        width: 100%;
        color: inherit;
      `}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          e.stopPropagation();
          return;
        }
        e.preventDefault();
      }}
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
    </StyledLink>
  );
};
