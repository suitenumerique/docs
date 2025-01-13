import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';
import { css } from 'styled-components';

import { Box, Card, Text } from '@/components';
import {
  DocDefaultFilter,
  useInfiniteDocs,
} from '@/features/docs/doc-management';
import { useResponsiveStore } from '@/stores';

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
  const hasDocs = data?.pages.some((page) => page.results.length > 0);
  const loadMore = (inView: boolean) => {
    if (!inView || loading) {
      return;
    }
    void fetchNextPage();
  };

  const title =
    target === DocDefaultFilter.MY_DOCS
      ? t('My docs')
      : target === DocDefaultFilter.SHARED_WITH_ME
        ? t('Shared with me')
        : t('All docs');

  return (
    <Box
      $position="relative"
      $width="100%"
      $maxWidth="960px"
      $maxHeight="calc(100vh - 52px - 1rem)"
      $align="center"
      $css={css`
        overflow-x: hidden;
        overflow-y: auto;
      `}
    >
      <DocsGridLoader isLoading={isRefetching || loading} />
      <Card
        data-testid="docs-grid"
        $height="100%"
        $width="100%"
        $css={css`
          overflow-x: hidden;
          overflow-y: auto;
        `}
        $padding={{
          top: 'base',
          horizontal: isDesktop ? 'md' : 'xs',
          bottom: 'md',
        }}
      >
        <Text
          as="h4"
          $size="h4"
          $variation="1000"
          $margin={{ top: '0px', bottom: '10px' }}
        >
          {title}
        </Text>

        {!hasDocs && (
          <Box $padding={{ vertical: 'sm' }} $align="center" $justify="center">
            <Text $size="sm" $variation="600" $weight="700">
              {t('No documents found')}
            </Text>
          </Box>
        )}
        {hasDocs && (
          <Box $gap="6px">
            <Box
              $direction="row"
              $padding={{ horizontal: 'xs' }}
              $gap="20px"
              data-testid="docs-grid-header"
            >
              <Box $flex={6} $padding="3xs">
                <Text $size="xs" $variation="600" $weight="500">
                  {t('Name')}
                </Text>
              </Box>
              {isDesktop && (
                <Box $flex={2} $padding="3xs">
                  <Text $size="xs" $weight="500" $variation="600">
                    {t('Updated at')}
                  </Text>
                </Box>
              )}

              <Box $flex={1.15} $align="flex-end" $padding="3xs" />
            </Box>

            {/* Body */}
            {data?.pages.map((currentPage) => {
              return currentPage.results.map((doc) => (
                <DocsGridItem doc={doc} key={doc.id} />
              ));
            })}
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
