import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, InfiniteScroll, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useInfiniteDocs } from '@/features/docs/doc-management';

import { LeftPanelFavoriteItem } from './LeftPanelFavoriteItem';

export const LeftPanelFavorites = () => {
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  const docs = useInfiniteDocs({
    page: 1,
    is_favorite: true,
  });

  const favoriteDocs = docs.data?.pages.flatMap((page) => page.results) || [];

  if (favoriteDocs.length === 0) {
    return null;
  }

  return (
    <Box>
      <HorizontalSeparator $withPadding={false} />
      <Box
        $justify="center"
        $padding={{ horizontal: 'sm', top: 'sm' }}
        $gap={spacing['2xs']}
        $height="100%"
        data-testid="left-panel-favorites"
      >
        <Text
          $size="sm"
          $variation="700"
          $padding={{ horizontal: '3xs' }}
          $weight="700"
        >
          {t('Pinned documents')}
        </Text>
        <InfiniteScroll
          hasMore={docs.hasNextPage}
          isLoading={docs.isFetchingNextPage}
          next={() => void docs.fetchNextPage()}
        >
          {favoriteDocs.map((doc) => (
            <LeftPanelFavoriteItem key={doc.id} doc={doc} />
          ))}
        </InfiniteScroll>
      </Box>
    </Box>
  );
};
