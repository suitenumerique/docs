import { t } from 'i18next';
import { DateTime } from 'luxon';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, SimpleDocItem } from '@/docs/doc-management';
import { DocsGridActions } from '@/docs/docs-grid';
import { useResponsiveStore } from '@/stores';

type LeftPanelFavoriteItemProps = {
  doc: Doc;
};

export const LeftPanelFavoriteItem = ({ doc }: LeftPanelFavoriteItemProps) => {
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  return (
    <Box
      as="li"
      $direction="row"
      $align="center"
      $justify="space-between"
      $css={css`
        padding: ${spacingsTokens['2xs']};
        border-radius: 4px;
        .pinned-actions {
          opacity: ${isDesktop ? 0 : 1};
        }
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--contextual--primary
          );
          .pinned-actions {
            opacity: 1;
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
        <SimpleDocItem showAccesses doc={doc} />
      </StyledLink>
      <Box className="pinned-actions" $align="center">
        <DocsGridActions doc={doc} />
      </Box>
    </Box>
  );
};
