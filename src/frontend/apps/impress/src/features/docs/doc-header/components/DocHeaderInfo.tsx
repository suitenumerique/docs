import { t } from 'i18next';
import React from 'react';

import { Box, Icon, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  Role,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import { useDate } from '@/hooks';
import { useResponsiveStore } from '@/stores';

interface DocHeaderInfoProps {
  doc: Doc;
}

export const DocHeaderInfo = ({ doc }: DocHeaderInfoProps) => {
  const { isDesktop } = useResponsiveStore();
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const { relativeDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();
  const { spacingsTokens } = useCunninghamTheme();

  const childrenCount = doc.numchild ?? 0;

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

  const hasChildren = childrenCount > 0;

  const separator = (
    <Text $variation="tertiary" $size="s">
      &nbsp;·&nbsp;
    </Text>
  );

  const encryptedBadge = doc.is_encrypted && (
    <>
      <Box
        $direction="row"
        $align="center"
        $gap={spacingsTokens['4xs']}
        data-testid="doc-header-encrypted"
      >
        <Icon iconName="verified_user" $size="sm" $theme="brand" />
        <Text $size="xs" $weight="500" $theme="brand">
          {t('Encrypted')}
        </Text>
      </Box>
      {separator}
    </>
  );

  if (isDesktop) {
    return (
      <>
        {encryptedBadge}
        <Text
          $variation="tertiary"
          $size="s"
          $weight="bold"
          $theme={isEditable ? 'gray' : 'warning'}
        >
          {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
        </Text>
        {separator}
        <Text $variation="tertiary" $size="s">
          {dateToDisplay}
        </Text>
      </>
    );
  }

  return (
    <>
      {encryptedBadge}
      <Text $variation="tertiary" $size="s">
        {hasChildren ? relativeOnly : dateToDisplay}
      </Text>
      {hasChildren && (
        <Text $variation="tertiary" $size="s">
          &nbsp;•&nbsp;
          {t('Contains {{count}} sub-documents', {
            count: childrenCount,
          })}
        </Text>
      )}
    </>
  );
};
