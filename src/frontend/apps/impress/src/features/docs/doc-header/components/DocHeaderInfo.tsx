import { t } from 'i18next';
import React from 'react';

import { Text } from '@/components';
import { useConfig } from '@/core';
import { useDate } from '@/hook';
import { useResponsiveStore } from '@/stores';

import {
  Doc,
  Role,
  useIsCollaborativeEditable,
  useTrans,
} from '../../doc-management';

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
          $variation="600"
          $size="s"
          $weight="bold"
          $theme={isEditable ? 'greyscale' : 'warning'}
        >
          {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
          &nbsp;·&nbsp;
        </Text>
        <Text $variation="600" $size="s">
          {dateToDisplay}
        </Text>
      </>
    );
  }

  return (
    <>
      <Text $variation="400" $size="s">
        {hasChildren ? relativeOnly : dateToDisplay}
      </Text>
      {hasChildren && (
        <Text $variation="400" $size="s">
          &nbsp;•&nbsp;
          {t('Contains {{count}} sub-documents', {
            count: childrenCount,
          })}
        </Text>
      )}
    </>
  );
};
