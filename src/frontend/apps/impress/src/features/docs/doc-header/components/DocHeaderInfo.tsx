import { t } from 'i18next';
import React from 'react';

import { Text } from '@/components';
import { useConfig } from '@/core';
import {
  Doc,
  Role,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import { useDate } from '@/hook';
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

  if (isDesktop) {
    return (
      <>
        <Text
          $variation="tertiary"
          $size="s"
          $weight="bold"
          $theme={isEditable ? 'gray' : 'warning'}
        >
          {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
          &nbsp;·&nbsp;
        </Text>
        <Text $variation="tertiary" $size="s">
          {dateToDisplay}
        </Text>
      </>
    );
  }

  return (
    <>
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
