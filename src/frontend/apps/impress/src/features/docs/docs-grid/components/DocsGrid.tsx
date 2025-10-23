import { Button } from '@openfun/cunningham-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';
import { css } from 'styled-components';

import { Box, Card, Text } from '@/components';
import { DocDefaultFilter, useInfiniteDocs } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { useInfiniteDocsTrashbin } from '../api';
import { useResponsiveDocGrid } from '../hooks/useResponsiveDocGrid';

import {
  DocGridContentList,
  DraggableDocGridContentList,
} from './DocGridContentList';
import { DocsGridLoader } from './DocsGridLoader';

type DocsGridProps = {
  target?: DocDefaultFilter;
};
export const DocsGrid = ({
  target = DocDefaultFilter.ALL_DOCS,
}: DocsGridProps) => {
  const { t } = useTranslation();

  const { isDesktop } = useResponsiveStore();
  const { flexLeft, flexRight } = useResponsiveDocGrid();

  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useDocsQuery(target);

  const docs = useMemo(() => {
    const allDocs = data?.pages.flatMap((page) => page.results) ?? [];
    // Deduplicate documents by ID to prevent the same doc appearing multiple times
    // This can happen when a multiple users are impacting the docs list (creation, update, ...)
    const seenIds = new Set<string>();
    return allDocs.filter((doc) => {
      if (seenIds.has(doc.id)) {
        return false;
      }
      seenIds.add(doc.id);
      return true;
    });
  }, [data?.pages]);

  const loading = isFetching || isLoading;
  const hasDocs = data?.pages.some((page) => page.results.length > 0);
  const loadMore = (inView: boolean) => {
    if (!inView || loading) {
      return;
    }
    void fetchNextPage();
  };

  let title = t('All docs');
  switch (target) {
    case DocDefaultFilter.MY_DOCS:
      title = t('My docs');
      break;
    case DocDefaultFilter.SHARED_WITH_ME:
      title = t('Shared with me');
      break;
    case DocDefaultFilter.TRASHBIN:
      title = t('Trashbin');
      break;
    default:
      title = t('All docs');
  }

  return (
    <Box
      $position="relative"
      $width="100%"
      $maxWidth="960px"
      $maxHeight="calc(100vh - 52px - 2rem)"
      $align="center"
      className="--docs--doc-grid"
    >
      <DocsGridLoader isLoading={isRefetching || loading} />
      <Card
        data-testid="docs-grid"
        $height="100%"
        $width="100%"
        $css={css`
          ${!isDesktop ? 'border: none;' : ''}
        `}
        $padding={{
          top: 'base',
          horizontal: isDesktop ? 'md' : 'xs',
          bottom: 'md',
        }}
      >
        <Text
          as="h2"
          $size="h4"
          $variation="1000"
          $margin={{ top: '0px', bottom: '10px' }}
        >
          {title}
        </Text>

        {!hasDocs && !loading && (
          <Box $padding={{ vertical: 'sm' }} $align="center" $justify="center">
            <Text $size="sm" $variation="600" $weight="700">
              {t('No documents found')}
            </Text>
          </Box>
        )}
        {hasDocs && (
          <Box $gap="6px" $overflow="auto">
            <Box role="grid" aria-label={t('Documents grid')}>
              <Box role="rowgroup">
                <Box
                  $direction="row"
                  $padding={{ horizontal: 'xs' }}
                  $gap="10px"
                  data-testid="docs-grid-header"
                  role="row"
                >
                  <Box $flex={flexLeft} $padding="3xs" role="columnheader">
                    <Text $size="xs" $variation="600" $weight="500">
                      {t('Name')}
                    </Text>
                  </Box>
                  {isDesktop && (
                    <Box
                      $flex={flexRight}
                      $padding={{ vertical: '3xs' }}
                      role="columnheader"
                    >
                      <Text $size="xs" $weight="500" $variation="600">
                        {DocDefaultFilter.TRASHBIN === target
                          ? t('Days remaining')
                          : t('Updated at')}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>
              <Box role="rowgroup">
                {isDesktop ? (
                  <DraggableDocGridContentList docs={docs} />
                ) : (
                  <DocGridContentList docs={docs} />
                )}
              </Box>
            </Box>
            {hasNextPage && !loading && (
              <InView
                data-testid="infinite-scroll-trigger"
                as="div"
                onChange={loadMore}
              >
                {!isFetching && hasNextPage && (
                  <Button
                    onClick={() => void fetchNextPage()}
                    color="primary-text"
                  >
                    {t('More docs')}
                  </Button>
                )}
              </InView>
            )}
          </Box>
        )}
      </Card>
    </Box>
  );
};

const useDocsQuery = (target: DocDefaultFilter) => {
  const trashbinQuery = useInfiniteDocsTrashbin(
    {
      page: 1,
    },
    {
      enabled: target === DocDefaultFilter.TRASHBIN,
    },
  );

  const docsQuery = useInfiniteDocs(
    {
      page: 1,
      ...(target &&
        target !== DocDefaultFilter.ALL_DOCS && {
          is_creator_me: target === DocDefaultFilter.MY_DOCS,
        }),
    },
    {
      enabled: target !== DocDefaultFilter.TRASHBIN,
    },
  );

  return target === DocDefaultFilter.TRASHBIN ? trashbinQuery : docsQuery;
};
