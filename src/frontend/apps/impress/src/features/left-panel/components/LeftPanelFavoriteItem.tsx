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
        &:hover {
          background-color: ${colorsTokens['greyscale-100']};
        }
        &:focus-within {
          cursor: pointer;
          box-shadow: 0 0 0 2px ${colorsTokens['primary-500']} !important;
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
      <div className="pinned-actions">
        <DocsGridActions doc={doc} openShareModal={shareModal.open} />
      </div>
      {shareModal.isOpen && (
        <DocShareModal doc={doc} onClose={shareModal.close} />
      )}
    </Box>
  );
};
