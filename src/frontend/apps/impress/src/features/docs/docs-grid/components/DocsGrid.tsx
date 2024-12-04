import { Button, Loader } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';

import { Box, Card, Text } from '@/components';
import { useResponsiveStore } from '@/stores';

import { DocDefaultFilter, useInfiniteDocs } from '../../doc-management';

import { DocsGridItem } from './DocsGridItem';
import { DocsGridLoader } from './DocsGridLoader';

type DocsGridProps = {
  target?: DocDefaultFilter;
};
export const DocsGrid = ({
  target = DocDefaultFilter.ALL_DOCS,
}: DocsGridProps) => {
  const { t } = useTranslation();

  const { isDesktop } = useResponsiveStore();

  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteDocs({
    page: 1,
    ...(target &&
      target !== DocDefaultFilter.ALL_DOCS && {
        is_creator_me: target === DocDefaultFilter.MY_DOCS,
      }),
  });
  const loading = isFetching || isLoading;

  const loadMore = (inView: boolean) => {
    if (!inView || loading) {
      return;
    }
    void fetchNextPage();
  };

  return (
    <Box $position="relative" $width="100%" $maxWidth="960px">
      <DocsGridLoader isLoading={isRefetching} />
      <Card data-testid="docs-grid" $padding="md">
        <Text
          as="h4"
          $size="h4"
          $weight="700"
          $margin={{ top: '0px', bottom: 'xs' }}
        >
          {t('All docs')}
        </Text>

        <Box>
          <Box $direction="row" $padding="xs" data-testid="docs-grid-header">
            <Box $flex={6} $padding="3xs">
              <Text $size="xs" $variation="600">
                {t('Name')}
              </Text>
            </Box>
            {isDesktop && (
              <Box $flex={1} $padding="3xs">
                <Text $size="xs" $variation="600">
                  {t('Updated at')}
                </Text>
              </Box>
            )}

            <Box $flex={1} $align="flex-end" $padding="3xs" />
          </Box>

          {/* Body */}
          {data?.pages.map((currentPage) => {
            return currentPage.results.map((doc) => (
              <DocsGridItem doc={doc} key={doc.id} />
            ));
          })}
        </Box>

        {loading && (
          <Box
            data-testid="docs-grid-loader"
            $padding="md"
            $align="center"
            $justify="center"
            $width="100%"
          >
            <Loader />
          </Box>
        )}
        {hasNextPage && !loading && (
          <InView
            data-testid="infinite-scroll-trigger"
            as="div"
            onChange={loadMore}
          >
            {!isFetching && hasNextPage && (
              <Button onClick={() => void fetchNextPage()} color="primary-text">
                {t('More docs')}
              </Button>
            )}
          </InView>
        )}
      </Card>
    </Box>
  );
};
