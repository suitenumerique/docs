import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Card, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, currentDocRole, useTrans } from '@/features/docs/doc-management';
import { useDate } from '@/hook';
import { useResponsiveStore } from '@/stores';

import { DocTagPublic } from './DocTagPublic';
import { DocTitle } from './DocTitle';
import { DocToolBox } from './DocToolBox';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { colorsTokens } = useCunninghamTheme();
  const { t } = useTranslation();
  const { formatDate } = useDate();
  const { transRole } = useTrans();
  const { isMobile, isSmallMobile } = useResponsiveStore();

  return (
    <>
      <Card
        $width="100%"
        $margin={isMobile ? 'tiny' : 'small'}
        aria-label={t('It is the card information about the document.')}
      >
        <Box
          $padding={isMobile ? 'tiny' : 'small'}
          $direction="row"
          $align="center"
        >
          <StyledLink href="/">
            <Text
              $isMaterialIcon
              $theme="primary"
              $variation="600"
              $size="2rem"
              $css={css`
                &:hover {
                  background-color: ${colorsTokens()['primary-100']};
                }
              `}
              $hasTransition
              $radius="5px"
              $padding="tiny"
            >
              home
            </Text>
          </StyledLink>
          <Box
            $width="1px"
            $height="70%"
            $background={colorsTokens()['greyscale-100']}
            $margin={{ horizontal: 'tiny' }}
          />
          <Box
            $direction="row"
            $justify="space-between"
            $css="flex:1;"
            $gap="0.5rem 1rem"
            $wrap="wrap"
            $align="center"
          >
            <DocTitle doc={doc} />
            <DocToolBox doc={doc} />
          </Box>
        </Box>
        <Box
          $direction={isSmallMobile ? 'column' : 'row'}
          $align={isSmallMobile ? 'start' : 'center'}
          $css="border-top:1px solid #eee"
          $padding={{
            horizontal: isMobile ? 'tiny' : 'big',
            vertical: 'tiny',
          }}
          $gap="0.5rem 2rem"
          $justify="space-between"
          $wrap="wrap"
          $position="relative"
        >
          <Box
            $direction={isSmallMobile ? 'column' : 'row'}
            $align={isSmallMobile ? 'start' : 'center'}
            $gap="0.5rem 2rem"
            $wrap="wrap"
          >
            <DocTagPublic doc={doc} />
            <Text $size="s" $display="inline">
              {t('Created at')} <strong>{formatDate(doc.created_at)}</strong>
            </Text>
          </Box>
          <Text $size="s" $display="inline">
            {t('Your role:')}{' '}
            <strong>{transRole(currentDocRole(doc.abilities))}</strong>
          </Text>
        </Box>
      </Card>
    </>
  );
};
