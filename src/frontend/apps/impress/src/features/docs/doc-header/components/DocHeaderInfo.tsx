import { t } from 'i18next';

import PublicSVG from '@/assets/icons/ui-kit/public.svg';
import ProtedtedSVG from '@/assets/icons/ui-kit/vpn_lock.svg';
import { Box, Text } from '@/components';
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

interface DocHeaderInfoProps {
  doc: Doc;
}

export const DocHeaderInfo = ({ doc }: DocHeaderInfoProps) => {
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const { relativeDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();

  const relativeOnly = relativeDate(doc.updated_at);

  let dateToDisplay = t('Last update: {{update}}', {
    update: relativeOnly,
  });

  if (config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${t('Days remaining:')} ${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  return (
    <Box $direction="row">
      <Text
        $variation="tertiary"
        $size="s"
        $weight="bold"
        $theme={isEditable ? 'neutral' : 'warning'}
        $direction="row"
      >
        <VisibilityDoc doc={doc} />
        {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
        &nbsp;·&nbsp;
      </Text>
      <Text $variation="tertiary" $size="s">
        {dateToDisplay}
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
