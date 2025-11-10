import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  LinkReach,
  Role,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import { useDate } from '@/hook';
import { useResponsiveStore } from '@/stores';

import { AlertNetwork } from './AlertNetwork';
import { AlertPublic } from './AlertPublic';
import { AlertRestore } from './AlertRestore';
import { BoutonShare } from './BoutonShare';
import { DocTitle } from './DocTitle';
import { DocToolBox } from './DocToolBox';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const docIsPublic = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const docIsAuth = getDocLinkReach(doc) === LinkReach.AUTHENTICATED;
  const { relativeDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();
  const isDeletedDoc = !!doc.deleted_at;

  let dateToDisplay = t('Last update: {{update}}', {
    update: relativeDate(doc.updated_at),
  });

  if (config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${t('Days remaining:')} ${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  return (
    <>
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '50px' : 'md' }}
        $gap={spacingsTokens['base']}
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
      >
        {isDeletedDoc && <AlertRestore doc={doc} />}
        {!isEditable && <AlertNetwork />}
        {(docIsPublic || docIsAuth) && (
          <AlertPublic isPublicDoc={docIsPublic} />
        )}
        <Box
          $direction="row"
          $align="center"
          $width="100%"
          $padding={{ bottom: 'xs' }}
        >
          <Box
            $direction="row"
            $justify="space-between"
            $css="flex:1;"
            $gap="0.5rem 1rem"
            $align="center"
            $maxWidth="100%"
          >
            <Box $gap={spacingsTokens['3xs']} $overflow="auto">
              <DocTitle doc={doc} />

              <Box $direction="row">
                {isDesktop && (
                  <>
                    <Text
                      $variation="600"
                      $size="s"
                      $weight="bold"
                      $theme={isEditable ? 'greyscale' : 'warning'}
                    >
                      {transRole(
                        isEditable
                          ? doc.user_role || doc.link_role
                          : Role.READER,
                      )}
                      &nbsp;·&nbsp;
                    </Text>
                    <Text $variation="600" $size="s">
                      {dateToDisplay}
                    </Text>
                  </>
                )}
                {!isDesktop && (
                  <Text $variation="400" $size="s">
                    {dateToDisplay}
                  </Text>
                )}
              </Box>
            </Box>
            {!isDeletedDoc && <DocToolBox doc={doc} />}
            {isDeletedDoc && (
              <BoutonShare
                doc={doc}
                open={() => {}}
                displayNbAccess={true}
                isDisabled
              />
            )}
          </Box>
        </Box>
        <HorizontalSeparator $withPadding={false} />
      </Box>
    </>
  );
};
