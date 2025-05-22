import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  LinkReach,
  Role,
  currentDocRole,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { AlertNetwork } from './AlertNetwork';
import { AlertPublic } from './AlertPublic';
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

  return (
    <>
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '50px' : 'md' }}
        $gap={spacingsTokens['base']}
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
      >
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
                          ? currentDocRole(doc.abilities)
                          : Role.READER,
                      )}
                      &nbsp;·&nbsp;
                    </Text>
                    <Text $variation="600" $size="s">
                      {t('Last update: {{update}}', {
                        update: DateTime.fromISO(doc.updated_at).toRelative(),
                      })}
                    </Text>
                  </>
                )}
                {!isDesktop && (
                  <Text $variation="400" $size="s">
                    {DateTime.fromISO(doc.updated_at).toRelative()}
                  </Text>
                )}
              </Box>
            </Box>
            <DocToolBox doc={doc} />
          </Box>
        </Box>
        <HorizontalSeparator $withPadding={false} />
      </Box>
    </>
  );
};
