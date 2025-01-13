import { useModal } from '@openfun/cunningham-react';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/features/docs/doc-management';
import { DocShareModal } from '@/features/docs/doc-share';
import { DocsGridActions, SimpleDocItem } from '@/features/docs/docs-grid';
import { useResponsiveStore } from '@/stores';

type LeftPanelFavoriteItemProps = {
  doc: Doc;
};

export const LeftPanelFavoriteItem = ({ doc }: LeftPanelFavoriteItemProps) => {
  const shareModal = useModal();
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const spacing = spacingsTokens();
  return (
    <Box
      $direction="row"
      $align="center"
      $justify="space-between"
      $css={css`
        padding: ${spacing['2xs']};
        border-radius: 4px;
        .pinned-actions {
          opacity: ${isDesktop ? 0 : 1};
        }
        &:hover {
          cursor: pointer;

          background-color: var(--c--theme--colors--greyscale-100);
          .pinned-actions {
            opacity: 1;
          }
        }
      `}
      key={doc.id}
    >
      <StyledLink href={`/docs/${doc.id}`}>
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
