import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
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
import { useDocChildren, useDocTree } from '../../doc-tree';

interface DocHeaderInfoProps {
  doc: Doc;
}

export const DocHeaderInfo = ({ doc }: DocHeaderInfoProps) => {
  const { data: tree } = useDocTree({ docId: doc.id });
  const { isDesktop } = useResponsiveStore();
  const treeContext = useTreeContext<Doc | null>();
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const { relativeDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();

  const { data: childrenPage } = useDocChildren(
    { docId: doc.id, page_size: 1 },
    { enabled: true },
  );
  const countFromTreeContext =
    treeContext?.root?.id === doc.id
      ? treeContext?.treeData?.nodes?.length
      : undefined;

  const childrenCount =
    countFromTreeContext ??
    childrenPage?.count ??
    doc.numchild ??
    tree?.children?.length ??
    0;

  let dateToDisplay = t('Last update: {{update}}', {
    update: relativeDate(doc.updated_at),
  });
  const relativeOnly = relativeDate(doc.updated_at);

  if (config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${t('Days remaining:')} ${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  const hasChildren = childrenCount > 0;
  return (
    <>
      {isDesktop ? (
        <>
          <Text
            $variation="600"
            $size="s"
            $weight="bold"
            $theme={isEditable ? 'greyscale' : 'warning'}
          >
            {transRole(
              isEditable ? doc.user_role || doc.link_role : Role.READER,
            )}
            &nbsp;·&nbsp;
          </Text>
          <Text $variation="600" $size="s">
            {dateToDisplay}
          </Text>
        </>
      ) : (
        <>
          <Text $variation="400" $size="s">
            {hasChildren ? relativeOnly : dateToDisplay}
          </Text>
          {hasChildren ? (
            <Text $variation="400" $size="s">
              &nbsp;•&nbsp;
              {t('Contains {{count}} sub-documents', {
                count: childrenCount,
              })}
            </Text>
          ) : null}
        </>
      )}
    </>
  );
};
