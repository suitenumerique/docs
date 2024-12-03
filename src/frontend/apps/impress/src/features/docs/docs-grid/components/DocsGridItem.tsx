import { Button } from '@openfun/cunningham-react';
import { DateTime } from 'luxon';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useResponsiveStore } from '@/stores';

import { Doc, LinkReach } from '../../doc-management';

import { DocsGridActions } from './DocsGridActions';
import { SimpleDocItem } from './SimpleDocItem';

type DocsGridItemProps = {
  doc: Doc;
};
export const DocsGridItem = ({ doc }: DocsGridItemProps) => {
  const { isDesktop } = useResponsiveStore();

  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isRestricted = doc.link_reach === LinkReach.RESTRICTED;
  const sharedCount = doc.nb_accesses - 1;
  const isShared = sharedCount > 0;

  return (
    <Box
      $direction="row"
      $width="100%"
      $align="center"
      role="row"
      $padding={{ vertical: 'xs', horizontal: 'sm' }}
      $css={css`
        cursor: pointer;
        border-radius: 4px;
        &:hover {
          background-color: var(--c--theme--colors--greyscale-100);
        }
      `}
    >
      <StyledLink $css="flex: 7; align-items: center;" href={`/docs/${doc.id}`}>
        <Box
          data-testid={`docs-grid-name-${doc.id}`}
          $flex={6}
          $padding={{ right: 'base' }}
        >
          <SimpleDocItem doc={doc} />
        </Box>
        {isDesktop && (
          <Box $flex={1}>
            <Text $variation="500" $size="xs">
              {DateTime.fromISO(doc.updated_at).toRelative()}
            </Text>
          </Box>
        )}
      </StyledLink>
      <Box
        $flex={1}
        $direction="row"
        $align="center"
        $justify="flex-end"
        $gap="10px"
      >
        {isDesktop && isPublic && (
          <Button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            size="nano"
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
            }}
            color="tertiary"
            size="nano"
            icon={<Icon $variation="800" $theme="primary" iconName="group" />}
          >
            {sharedCount}
          </Button>
        )}
        {isDesktop && !isPublic && isAuthenticated && (
          <Button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            size="nano"
            icon={<Icon $variation="000" iconName="corporate_fare" />}
          >
            {sharedCount}
          </Button>
        )}
        <DocsGridActions doc={doc} />
      </Box>
    </Box>
  );
};
