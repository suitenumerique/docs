import { Tooltip } from '@gouvfr-lasuite/ui-components';
import { t } from 'i18next';

import { Box, Icon, Text } from '@/components';
import { useConfig } from '@/core';
import {
  Doc,
  LinkReach,
  Role,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import { useDate } from '@/hooks';
import PublicSVG from '@/icons/public.svg';
import StarIcon from '@/icons/star-filled.svg';
import ProtedtedSVG from '@/icons/vpn_lock.svg';

interface DocHeaderInfoProps {
  doc: Doc;
}

export const DocHeaderInfo = ({ doc }: DocHeaderInfoProps) => {
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const { relativeDate, formatDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();

  const relativeOnly = relativeDate(doc.updated_at);
  const fullDate = formatDate(doc.updated_at);

  const trashbinCutoff = config?.TRASHBIN_CUTOFF_DAYS;

  let dateLabel: string;
  let dateValue: string;

  if (trashbinCutoff && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(doc.deleted_at, trashbinCutoff);
    dateLabel = t('Days remaining:');
    dateValue = `${daysLeft} ${t('days', { count: daysLeft })}`;
  } else {
    dateLabel = t('Last update:');
    dateValue = relativeOnly;
  }

  return (
    <Box as="dl" $direction="row" $align="center" $margin="0" $gap="3xs">
      {doc.is_favorite && (
        <>
          <Text as="dt" className="sr-only">
            {t('This document is starred')}
          </Text>
          <Text
            as="dd"
            $variation="tertiary"
            $size="s"
            $weight="bold"
            $theme={isEditable ? 'neutral' : 'warning'}
            $direction="row"
            $margin="0"
          >
            <Icon
              $layer="background"
              $theme="neutral"
              $variation="primary"
              $size="sm"
              icon={<StarIcon aria-hidden="true" width={16} height={16} />}
            />
          </Text>
        </>
      )}
      <Text as="dt" className="sr-only">
        {t('Role')}
      </Text>
      <Text
        as="dd"
        $variation="tertiary"
        $size="s"
        $weight="bold"
        $theme={isEditable ? 'neutral' : 'warning'}
        $direction="row"
        $margin="0"
      >
        <VisibilityDoc doc={doc} />
        {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
        &nbsp;&nbsp;·&nbsp;
      </Text>
      <Text as="dt" $variation="tertiary" $size="s" $margin="0">
        {dateLabel}
        &nbsp;
      </Text>
      <Text
        as="dd"
        $variation="tertiary"
        $size="s"
        $direction="row"
        $align="center"
        $margin="0"
      >
        {trashbinCutoff && doc.deleted_at ? (
          dateValue
        ) : (
          <Tooltip content={fullDate} placement="top">
            <time dateTime={doc.updated_at}>{relativeOnly}</time>
          </Tooltip>
        )}
      </Text>
    </Box>
  );
};

const VisibilityDoc = ({ doc }: { doc: Doc }) => {
  const docIsPublic = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const docIsAuth = getDocLinkReach(doc) === LinkReach.AUTHENTICATED;

  if (docIsPublic) {
    return (
      <>
        <PublicSVG aria-hidden="true" width="16" height="16" />
        &nbsp;{t('Public')}&nbsp;·&nbsp;
      </>
    );
  }

  if (docIsAuth) {
    return (
      <>
        <ProtedtedSVG aria-hidden="true" width="16" height="16" />
        &nbsp;{t('Internal')}&nbsp;·&nbsp;
      </>
    );
  }
};
