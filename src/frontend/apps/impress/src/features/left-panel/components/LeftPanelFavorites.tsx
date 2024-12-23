import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  InfiniteScroll,
  SeparatedSection,
  StyledLink,
  Text,
} from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useInfiniteDocs } from '@/features/docs';
import { SimpleDocItem } from '@/features/docs/docs-grid/components/SimpleDocItem';

export const LeftPanelFavorites = () => {
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  const docs = useInfiniteDocs({
    page: 1,
    is_favorite: true,
  });

  const invitations = docs.data?.pages.flatMap((page) => page.results) || [];

  if (invitations.length === 0) {
    return null;
  }

  return (
    <SeparatedSection showSeparator={true}>
      <Box
        $justify="center"
        $padding={{ horizontal: 'sm' }}
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
          {invitations.map((doc) => (
            <Box
              $css={css`
                padding: ${spacing['2xs']};
                border-radius: 4px;
                &:hover {
                  cursor: pointer;
                  background-color: var(--c--theme--colors--greyscale-100);
                }
              `}
              key={doc.id}
            >
              <StyledLink href={`/docs/${doc.id}`}>
                <SimpleDocItem showAccesses doc={doc} />
              </StyledLink>
            </Box>
          ))}
        </InfiniteScroll>
      </Box>
    </SeparatedSection>
  );
};
