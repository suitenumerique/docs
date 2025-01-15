import { Button, useModal } from '@openfun/cunningham-react';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { Doc, LinkReach } from '@/features/docs/doc-management';
import { DocShareModal } from '@/features/docs/doc-share';
import { useResponsiveStore } from '@/stores';

import { DocsGridActions } from './DocsGridActions';
import { SimpleDocItem } from './SimpleDocItem';

type DocsGridItemProps = {
  doc: Doc;
};
export const DocsGridItem = ({ doc }: DocsGridItemProps) => {
  const { isDesktop } = useResponsiveStore();

  const shareModal = useModal();
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isRestricted = doc.link_reach === LinkReach.RESTRICTED;
  const sharedCount = doc.nb_accesses - 1;
  const isShared = sharedCount > 0;

  const handleShareClick = () => {
    shareModal.open();
  };

  const icon = useMemo(() => {
    if (isPublic) {
      return 'public';
    }
    if (isAuthenticated) {
      return 'corporate_fare';
    }
    if (isRestricted) {
      return 'group';
    }

    return undefined;
  }, [isPublic, isAuthenticated, isRestricted]);

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
          {!doc.abilities.accesses_view && icon && (
            <Box $align="center" $width="100%">
              <Icon $variation="800" $theme="primary" iconName={icon} />
            </Box>
          )}
          {doc.abilities.accesses_view && (
            <>
              {isDesktop && isPublic && (
                <Button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleShareClick();
                  }}
                  size="nano"
                  fullWidth
                  icon={<Icon $variation="000" iconName="public" />}
                >
                  {isShared ? sharedCount : undefined}
                </Button>
              )}
              {isDesktop && !isPublic && isRestricted && isShared && (
                <Button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleShareClick();
                  }}
                  fullWidth
                  color="tertiary"
                  size="nano"
                  icon={
                    <Icon $variation="800" $theme="primary" iconName="group" />
                  }
                >
                  {isShared ? sharedCount : undefined}
                </Button>
              )}
              {isDesktop && !isPublic && isAuthenticated && (
                <Button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleShareClick();
                  }}
                  fullWidth
                  size="nano"
                  icon={<Icon $variation="000" iconName="corporate_fare" />}
                >
                  {isShared ? sharedCount : undefined}
                </Button>
              )}
            </>
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
