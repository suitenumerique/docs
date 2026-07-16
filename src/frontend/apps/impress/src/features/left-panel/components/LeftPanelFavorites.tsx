import { useDroppable } from '@dnd-kit/core';
import { DateTime } from 'luxon';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  HorizontalSeparator,
  InfiniteScroll,
  StyledLink,
  Text,
} from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  SimpleDocItem,
  useInfiniteDocsFavorite,
} from '@/docs/doc-management';
import { useDocDnd } from '@/features/docs/DocDndContext';
import { DocsGridActions } from '@/features/docs/docs-grid';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

export const LeftPanelFavorites = () => {
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();

  const docs = useInfiniteDocsFavorite({
    page: 1,
  });

  const favoriteDocs = docs.data?.pages.flatMap((page) => page.results) || [];

  if (favoriteDocs.length === 0) {
    return null;
  }

  return (
    <Box as="section" className="--docs--left-panel-favorites">
      <HorizontalSeparator $margin="none" />
      <Box
        $justify="center"
        $padding={{ horizontal: 'sm', top: 'sm' }}
        $gap={spacingsTokens['2xs']}
        $height="100%"
        data-testid="left-panel-favorites"
      >
        <Text
          as="h2"
          $size="sm"
          $padding={{ horizontal: '3xs' }}
          $weight="700"
          $margin="0"
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

type LeftPanelFavoriteItemProps = {
  doc: Doc;
};

export const LeftPanelFavoriteItem = ({ doc }: LeftPanelFavoriteItemProps) => {
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const { isLargeScreen } = useResponsiveStore();
  const { t } = useTranslation();
  const dnd = useDocDnd();
  const canDrag = dnd?.canDrag ?? false;
  const updateCanDrop = dnd?.updateCanDrop;
  const isSelf = dnd?.selectedDoc?.id === doc.id;
  const canDrop = doc.abilities.move;
  const { isOver, setNodeRef } = useDroppable({
    id: `favorite-${doc.id}`,
    data: doc,
  });
  const showDropHint = canDrag && canDrop && isOver && !isSelf;

  useEffect(() => {
    if (isOver && !isSelf) {
      updateCanDrop?.(canDrop, isOver);
    }
  }, [isOver, isSelf, canDrop, updateCanDrop]);

  return (
    <Box
      as="li"
      ref={setNodeRef}
      $direction="row"
      $align="center"
      $justify="space-between"
      $css={css`
        padding: ${spacingsTokens['2xs']};
        border-radius: var(--c--globals--spacings--st);
        border: 1.5px solid
          ${showDropHint
            ? 'var(--c--globals--colors--brand-500)'
            : 'transparent'};
        background-color: ${showDropHint
          ? 'var(--c--globals--colors--brand-100)'
          : 'transparent'};
        .pinned-actions {
          opacity: ${isLargeScreen ? 0 : 1};
        }
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--contextual--primary
          );
          .pinned-actions {
            opacity: 1;
          }
        }
        body.is-dnd-dragging &:hover {
          background-color: ${showDropHint
            ? 'var(--c--globals--colors--brand-100)'
            : 'transparent'};
          .pinned-actions {
            opacity: ${isLargeScreen ? 0 : 1};
          }
        }
        &:focus-within {
          cursor: pointer;
          box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
          .pinned-actions {
            opacity: 1;
          }
        }
      `}
      key={doc.id}
      className="--docs--left-panel-favorite-item"
    >
      <StyledLink
        href={`/docs/${doc.id}`}
        $css={css`
          overflow: auto;
          outline: none !important;
        `}
        aria-label={`${doc.title}, ${t('Updated')} ${DateTime.fromISO(doc.updated_at).toRelative()}`}
      >
        <SimpleDocItem showDate doc={doc} />
      </StyledLink>
      <Box className="pinned-actions" $align="center">
        <DocsGridActions doc={doc} />
      </Box>
    </Box>
  );
};
