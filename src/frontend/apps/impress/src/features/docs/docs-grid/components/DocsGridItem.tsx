import { useModal } from '@openfun/cunningham-react';
import { DateTime } from 'luxon';
import { css } from 'styled-components';

import { Box, StyledLink, Text } from '@/components';
import { Doc } from '@/features/docs/doc-management';
import { DocShareModal } from '@/features/docs/doc-share';
import { useResponsiveStore } from '@/stores';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';
import { SimpleDocItem } from './SimpleDocItem';

type DocsGridItemProps = {
  doc: Doc;
};
export const DocsGridItem = ({ doc }: DocsGridItemProps) => {
  const { isDesktop } = useResponsiveStore();

  const shareModal = useModal();

  const handleShareClick = () => {
    shareModal.open();
  };

  return (
    <>
      <Box
        $direction="row"
        $width="100%"
        $align="center"
        $gap="20px"
        role="row"
        $padding={{ vertical: '2xs', horizontal: isDesktop ? 'base' : 'xs' }}
        $css={css`
          cursor: pointer;
          border-radius: 4px;
          &:hover {
            background-color: var(--c--theme--colors--greyscale-100);
          }
        `}
      >
        <StyledLink
          $css="flex: 8; align-items: center;"
          href={`/docs/${doc.id}`}
        >
          <Box
            data-testid={`docs-grid-name-${doc.id}`}
            $flex={6}
            $padding={{ right: 'base' }}
          >
            <SimpleDocItem isPinned={doc.is_favorite} doc={doc} />
          </Box>
          {isDesktop && (
            <Box $flex={2}>
              <Text $variation="600" $size="xs">
                {DateTime.fromISO(doc.updated_at).toRelative()}
              </Text>
            </Box>
          )}
        </StyledLink>
        <Box
          $flex={1.15}
          $direction="row"
          $align="center"
          $justify="flex-end"
          $gap="32px"
        >
          {isDesktop && (
            <DocsGridItemSharedButton
              doc={doc}
              handleClick={handleShareClick}
            />
          )}

          <DocsGridActions doc={doc} openShareModal={handleShareClick} />
        </Box>
      </Box>
      {shareModal.isOpen && (
        <DocShareModal doc={doc} onClose={shareModal.close} />
      )}
    </>
  );
};
