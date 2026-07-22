import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useSearchParams } from 'next/navigation';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import type { BoxType } from '@/components';
import { Box, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach, SimpleDocItem, useTrans } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useDate } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';

type DocsGridItemProps = BoxType & {
  doc: Doc;
  dragMode?: boolean;
};

export const DocsGridItem = ({
  doc,
  dragMode = false,
  $css,
  ...boxProps
}: DocsGridItemProps) => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');
  const isInTrashbin = target === 'trashbin';
  const { untitledDocument } = useTrans();

  const { t } = useTranslation();
  const { isSmallMobile, isLargeScreen } = useResponsiveStore();
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);
  const { openPanel } = useLeftPanelStore();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (e.target as HTMLAnchorElement).click();
    }
  };

  /**
   * When coming from the index page, we want the left panel to be open by default
   */
  const handleClick = () => {
    if (isLargeScreen) {
      openPanel();
    }
  };

  return (
    <Box
      $display="grid"
      $padding={{ vertical: '4xs' }}
      $align="center"
      $cursor="pointer"
      $css={css`
        grid-column: 1 / -1;
        grid-template-columns: subgrid;

        &:nth-child(1n):not(:last-child) {
          border-bottom: 1px solid
            var(--c--contextuals--border--surface--primary);
        }

        ${$css}
      `}
      className="--docs--doc-grid-item"
      aria-label={t('Open document: {{title}}', {
        title: doc.title || untitledDocument,
      })}
      {...boxProps}
      role="listitem"
      tabIndex={-1}
    >
      <Box
        tabIndex={0}
        $display="grid"
        $direction="row"
        $align="center"
        $justify="space-between"
        $gap="20px"
        $margin={{
          vertical: '3xs',
        }}
        $padding={{ right: '3xs' }}
        $css={css`
          grid-template-columns: subgrid;
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
          cursor: pointer;
          border-radius: 4px;
          &:hover {
            background-color: ${
              dragMode
                ? 'none'
                : 'var(--c--contextuals--background--semantic--contextual--primary)'
            };
          }
        `}
      >
        <Box
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
            onClick={handleClick}
          >
            <DocsGridItemTitle doc={doc} withTooltip={!dragMode} />
          </StyledLink>
        </Box>

        {!isSmallMobile && (
          <StyledLink
            href={`/docs/${doc.id}`}
            tabIndex={-1}
            aria-label={t('{{title}}, updated {{date}}', {
              title: doc.title || untitledDocument,
              date: dateToDisplay,
            })}
          >
            <DocsGridItemDate doc={doc} isInTrashbin={isInTrashbin} />
          </StyledLink>
        )}

        <Box
          $direction="row"
          $align="center"
          $justify="flex-end"
          $gap="sm"
          onKeyDown={(e) => e.stopPropagation()}
        >
          {!isSmallMobile && (
            <DocsGridItemSharedButton doc={doc} disabled={isInTrashbin} />
          )}
          <DocsGridActions doc={doc} isInTrashbin={isInTrashbin} />
        </Box>
      </Box>
    </Box>
  );
};

export const DocsGridItemTitle = ({
  doc,
  withTooltip,
}: {
  doc: Doc;
  withTooltip: boolean;
}) => {
  const { t } = useTranslation();
  const { isDesktop, isSmallMobile } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isShared = isPublic || isAuthenticated;

  return (
    <Box
      data-testid={`docs-grid-name-${doc.id}`}
      $direction="row"
      $align="center"
      $gap={spacingsTokens.xs}
      $padding={{ right: isDesktop ? 'md' : '3xs' }}
      $maxWidth="100%"
    >
      <SimpleDocItem
        isPinned={doc.is_favorite}
        doc={doc}
        showDate={isSmallMobile}
      />
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
          {withTooltip ? (
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
              <Box>
                <IconPublic isPublic={isPublic} />
              </Box>
            </Tooltip>
          ) : (
            <IconPublic isPublic={isPublic} />
          )}
        </Box>
      )}
    </Box>
  );
};

const IconPublic = ({ isPublic }: { isPublic: boolean }) => {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
};

const useDateToDisplay = (doc: Doc, isInTrashbin: boolean) => {
  const { data: config } = useConfig();
  const { t } = useTranslation();
  const { relativeDate, calculateDaysLeft } = useDate();

  let dateToDisplay = relativeDate(doc.updated_at);

  if (isInTrashbin && config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  return dateToDisplay;
};

export const DocsGridItemDate = ({
  doc,
  isInTrashbin,
}: {
  doc: Doc;
  isInTrashbin: boolean;
}) => {
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);

  return (
    <Text
      $size="xs"
      $layer="background"
      $theme="neutral"
      $variation="primary"
      $shrink="0"
    >
      {dateToDisplay}
    </Text>
  );
};
