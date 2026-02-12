import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useSearchParams } from 'next/navigation';
import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach, SimpleDocItem } from '@/docs/doc-management';
import { useDate } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import { useResponsiveDocGrid } from '../hooks/useResponsiveDocGrid';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';
import { DocsGridTrashbinActions } from './DocsGridTrashbinActions';

type DocsGridItemProps = {
  doc: Doc;
  dragMode?: boolean;
};

export const DocsGridItem = ({ doc, dragMode = false }: DocsGridItemProps) => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');
  const isInTrashbin = target === 'trashbin';

  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { flexLeft, flexRight } = useResponsiveDocGrid();
  const { spacingsTokens } = useCunninghamTheme();
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isShared = isPublic || isAuthenticated;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (e.target as HTMLAnchorElement).click();
    }
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
            background-color: ${dragMode
              ? 'none'
              : 'var(--c--contextuals--background--semantic--contextual--primary)'};
          }
        `}
        className="--docs--doc-grid-item"
        aria-label={t('Open document: {{title}}', {
          title: doc.title || t('Untitled document'),
        })}
      >
        <Box
          $flex={flexLeft}
          role="gridcell"
          $css={css`
            align-items: center;
            min-width: 0;
          `}
        >
          <StyledLink
            $css={css`
              width: 100%;
              align-items: center;
              min-width: 0;
            `}
            href={`/docs/${doc.id}`}
            onKeyDown={handleKeyDown}
          >
            <Box
              data-testid={`docs-grid-name-${doc.id}`}
              $direction="row"
              $align="center"
              $gap={spacingsTokens.xs}
              $padding={{ right: isDesktop ? 'md' : '3xs' }}
              $maxWidth="100%"
            >
              <SimpleDocItem isPinned={doc.is_favorite} doc={doc} />
              {isShared && (
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
                  {dragMode && (
                    <>
                      <Icon
                        $layer="background"
                        $theme="neutral"
                        $variation="primary"
                        $size="14px"
                        iconName={isPublic ? 'public' : 'vpn_lock'}
                      />
                      <span className="sr-only">
                        {isPublic
                          ? t('Accessible to anyone')
                          : t('Accessible to authenticated users')}
                      </span>
                    </>
                  )}
                  {!dragMode && (
                    <Tooltip
                      content={
                        <Text $textAlign="center">
                          {isPublic
                            ? t('Accessible to anyone')
                            : t('Accessible to authenticated users')}
                        </Text>
                      }
                      placement="top"
                    >
                      <div>
                        <Icon
                          $layer="background"
                          $theme="neutral"
                          $variation="primary"
                          $size="sm"
                          iconName={isPublic ? 'public' : 'vpn_lock'}
                        />
                        <span className="sr-only">
                          {isPublic
                            ? t('Accessible to anyone')
                            : t('Accessible to authenticated users')}
                        </span>
                      </div>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </StyledLink>
        </Box>

        <Box
          $flex={flexRight}
          $direction="row"
          $align="center"
          $justify={isDesktop ? 'space-between' : 'flex-end'}
          $gap="32px"
          role="gridcell"
        >
          <DocsGridItemDate
            doc={doc}
            isDesktop={isDesktop}
            isInTrashbin={isInTrashbin}
          />

          <Box $direction="row" $align="center" $gap={spacingsTokens.lg}>
            {isDesktop && (
              <DocsGridItemSharedButton doc={doc} disabled={isInTrashbin} />
            )}
            {isInTrashbin ? (
              <DocsGridTrashbinActions doc={doc} />
            ) : (
              <DocsGridActions doc={doc} />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export const DocsGridItemDate = ({
  doc,
  isDesktop,
  isInTrashbin,
}: {
  doc: Doc;
  isDesktop: boolean;
  isInTrashbin: boolean;
}) => {
  const { data: config } = useConfig();
  const { t } = useTranslation();
  const { relativeDate, calculateDaysLeft } = useDate();

  if (!isDesktop) {
    return null;
  }

  let dateToDisplay = relativeDate(doc.updated_at);

  if (isInTrashbin && config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  return (
    <StyledLink href={`/docs/${doc.id}`} tabIndex={-1}>
      <Text
        $size="xs"
        $layer="background"
        $theme="neutral"
        $variation="primary"
      >
        {dateToDisplay}
      </Text>
    </StyledLink>
  );
};
