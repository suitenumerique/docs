import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, InfiniteScroll, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useInfiniteDocs } from '@/docs/doc-management';

import { LeftPanelFavoriteItem } from './LeftPanelFavoriteItem';

export const LeftPanelFavorites = () => {
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();

  const docs = useInfiniteDocs({
    page: 1,
    is_favorite: true,
  });

  const favoriteDocs = docs.data?.pages.flatMap((page) => page.results) || [];

  if (favoriteDocs.length === 0) {
    return null;
  }

  return (
    <Box
      as="section"
      aria-labelledby="pinned-docs-title"
      className="--docs--left-panel-favorites"
    >
      <HorizontalSeparator $withPadding={false} />
      <Box
        $justify="center"
        $padding={{ horizontal: 'sm', top: 'sm' }}
        $gap={spacingsTokens['2xs']}
        $height="100%"
        data-testid="left-panel-favorites"
      >
        <Text
          $size="sm"
          $padding={{ horizontal: '3xs' }}
          $weight="700"
          id="pinned-docs-title"
        >
          {t('Pinned documents')}
        </Text>
        <Box>
          <Box as="ul" $padding="none" $margin={{ top: '4xs' }}>
            {favoriteDocs.map((doc) => (
              <LeftPanelFavoriteItem key={doc.id} doc={doc} />
            ))}
          </Box>
          {docs.hasNextPage && (
            <InfiniteScroll
              hasMore={docs.hasNextPage}
              isLoading={docs.isFetchingNextPage}
              next={() => void docs.fetchNextPage()}
              $padding="none"
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};
