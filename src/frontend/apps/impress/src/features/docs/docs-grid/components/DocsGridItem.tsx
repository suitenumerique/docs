import { Tooltip, useModal } from '@openfun/cunningham-react';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach } from '@/docs/doc-management';
import { DocShareModal } from '@/docs/doc-share';
import { useResponsiveStore } from '@/stores';

import { useResponsiveDocGrid } from '../hooks/useResponsiveDocGrid';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';
import { SimpleDocItem } from './SimpleDocItem';
type DocsGridItemProps = {
  doc: Doc;
};
export const DocsGridItem = ({ doc }: DocsGridItemProps) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { flexLeft, flexRight } = useResponsiveDocGrid();
  const { spacingsTokens } = useCunninghamTheme();
  const shareModal = useModal();
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;

  const showAccesses = isPublic || isAuthenticated;

  const handleShareClick = () => {
    shareModal.open();
  };

  return (
    <>
      <Box
        $direction="row"
        $width="100%"
        $align="center"
        role="row"
        $gap="20px"
        $padding={{ vertical: '4xs', horizontal: isDesktop ? 'base' : 'xs' }}
        $css={css`
          cursor: pointer;
          border-radius: 4px;
          &:hover {
            background-color: var(--c--theme--colors--greyscale-100);
          }
        `}
        className="--docs--doc-grid-item"
      >
        <StyledLink
          $css={css`
            flex: ${flexLeft};
            align-items: center;
            min-width: 0;
          `}
          href={`/docs/${doc.id}`}
        >
          <Box
            data-testid={`docs-grid-name-${doc.id}`}
            $direction="row"
            $align="center"
            $gap={spacingsTokens.xs}
            $flex={flexLeft}
            $padding={{ right: isDesktop ? 'md' : '3xs' }}
            $maxWidth="100%"
          >
            <SimpleDocItem isPinned={doc.is_favorite} doc={doc} />
            {showAccesses && (
              <Box
                $padding={{ top: !isDesktop ? '4xs' : undefined }}
                $css={
                  !isDesktop
                    ? css`
                        align-self: flex-start;
                      `
                    : undefined
                }
              >
                <Tooltip
                  content={
                    <Text $textAlign="center" $variation="000">
                      {isPublic
                        ? t('Accessible to anyone')
                        : t('Accessible to authenticated users')}
                    </Text>
                  }
                  placement="top"
                >
                  <div>
                    <Icon
                      $theme="greyscale"
                      $variation="600"
                      $size="14px"
                      iconName={isPublic ? 'public' : 'vpn_lock'}
                    />
                  </div>
                </Tooltip>
              </Box>
            )}
          </Box>
        </StyledLink>

        <Box
          $flex={flexRight}
          $direction="row"
          $align="center"
          $justify={isDesktop ? 'space-between' : 'flex-end'}
          $gap="32px"
        >
          {isDesktop && (
            <StyledLink href={`/docs/${doc.id}`}>
              <Text $variation="600" $size="xs">
                {DateTime.fromISO(doc.updated_at).toRelative()}
              </Text>
            </StyledLink>
          )}

          <Box $direction="row" $align="center" $gap={spacingsTokens.lg}>
            {isDesktop && (
              <DocsGridItemSharedButton
                doc={doc}
                handleClick={handleShareClick}
              />
            )}
            <DocsGridActions doc={doc} openShareModal={handleShareClick} />
          </Box>
        </Box>
      </Box>
      {shareModal.isOpen && (
        <DocShareModal doc={doc} onClose={shareModal.close} />
      )}
    </>
  );
};
