import { useModal } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, SimpleDocItem } from '@/docs/doc-management';
import { DocShareModal } from '@/docs/doc-share';
import { DocsGridActions } from '@/docs/docs-grid';
import { useResponsiveStore } from '@/stores';

type LeftPanelFavoriteItemProps = {
  doc: Doc;
};

export const LeftPanelFavoriteItem = ({ doc }: LeftPanelFavoriteItemProps) => {
  const shareModal = useModal();
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
        &:hover,
        &:focus-within {
          cursor: pointer;

          background-color: var(--c--theme--colors--greyscale-100);
          .pinned-actions {
            opacity: 1;
          }
        }
        &:focus-visible {
          outline: 2px solid ${colorsTokens['primary-500']};
          outline-offset: 2px;
          border-radius: ${spacingsTokens['3xs']};
        }
      `}
      key={doc.id}
      className="--docs--left-panel-favorite-item"
    >
      <StyledLink
        href={`/docs/${doc.id}`}
        $css="overflow: auto;"
        aria-label={`${doc.title}, ${t('Updated')} ${DateTime.fromISO(doc.updated_at).toRelative()}`}
      >
        <SimpleDocItem showAccesses doc={doc} />
      </StyledLink>
      <div className="pinned-actions">
        <DocsGridActions doc={doc} openShareModal={shareModal.open} />
      </div>
      {shareModal.isOpen && (
        <DocShareModal doc={doc} onClose={shareModal.close} />
      )}
    </Box>
  );
};
