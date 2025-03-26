import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, HorizontalSeparator, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  LinkReach,
  currentDocRole,
  useTrans,
} from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { DocTitle } from './DocTitle';
import { DocToolBox } from './DocToolBox';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const spacings = spacingsTokens();
  const colors = colorsTokens();

  const { t } = useTranslation();
  const docIsPublic = doc.link_reach === LinkReach.PUBLIC;
  const docIsAuth = doc.link_reach === LinkReach.AUTHENTICATED;

  const { transRole } = useTrans();

  return (
    <>
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '4xl' : 'md' }}
        $gap={spacings['base']}
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
      >
        {(docIsPublic || docIsAuth) && (
          <Box
            aria-label={t('Public document')}
            $color={colors['primary-800']}
            $background={colors['primary-050']}
            $radius={spacings['3xs']}
            $direction="row"
            $padding="xs"
            $flex={1}
            $align="center"
            $gap={spacings['3xs']}
            $css={css`
              border: 1px solid var(--c--theme--colors--primary-300, #e3e3fd);
            `}
          >
            <Icon
              $theme="primary"
              $variation="800"
              data-testid="public-icon"
              iconName={docIsPublic ? 'public' : 'vpn_lock'}
            />
            <Text $theme="primary" $variation="800">
              {docIsPublic
                ? t('Public document')
                : t('Document accessible to any connected person')}
            </Text>
          </Box>
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
            <Box $gap={spacings['3xs']} $overflow="auto">
              <DocTitle doc={doc} />

              <Box $direction="row">
                {isDesktop && (
                  <>
                    <Text $variation="600" $size="s" $weight="bold">
                      {transRole(currentDocRole(doc.abilities))}&nbsp;·&nbsp;
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
