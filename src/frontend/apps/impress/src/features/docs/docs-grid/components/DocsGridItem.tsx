import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useSearchParams } from 'next/navigation';
import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach, SimpleDocItem, useTrans } from '@/docs/doc-management';
import { useDate } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import { useResponsiveDocGrid } from '../hooks/useResponsiveDocGrid';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';
import { DocsGridTrashbinActions } from './DocsGridTrashbinActions';

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

const useDocItemAriaLabel = (doc: Doc, isInTrashbin: boolean) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);
  const title = doc.title || untitledDocument;
  const participantCount = Math.max((doc.nb_accesses_direct ?? 1) - 1, 0);

  return t(
    '{{title}}, updated {{date}}, shared with {{count}} participant(s)',
    {
      title,
      date: dateToDisplay,
      count: participantCount,
    },
  );
};

type DocsGridItemProps = {
  doc: Doc;
  dragMode?: boolean;
};

export const DocsGridItem = ({ doc, dragMode = false }: DocsGridItemProps) => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');
  const isInTrashbin = target === 'trashbin';

  const { isDesktop } = useResponsiveStore();
  const { flexLeft, flexRight } = useResponsiveDocGrid();
  const { spacingsTokens } = useCunninghamTheme();
  const docItemAriaLabel = useDocItemAriaLabel(doc, isInTrashbin);

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
        role="listitem"
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
      >
        <Box
          $flex={flexLeft}
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
            aria-label={docItemAriaLabel}
          >
            <DocsGridItemTitle doc={doc} withTooltip={!dragMode} />
          </StyledLink>
        </Box>

        <Box
          $flex={flexRight}
          $direction="row"
          $align="center"
          $justify={isDesktop ? 'space-between' : 'flex-end'}
          $gap="32px"
        >
          <Box aria-hidden="true">
            <DocsGridItemDate
              doc={doc}
              isDesktop={isDesktop}
              isInTrashbin={isInTrashbin}
            />
          </Box>

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

export const DocsGridItemTitle = ({
  doc,
  withTooltip,
}: {
  doc: Doc;
  withTooltip: boolean;
}) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
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

export const DocsGridItemDate = ({
  doc,
  isDesktop,
  isInTrashbin,
}: {
  doc: Doc;
  isDesktop: boolean;
  isInTrashbin: boolean;
}) => {
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);

  if (!isDesktop) {
    return null;
  }

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
