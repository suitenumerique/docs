import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text, TextStyled } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box>
      <Box
        as="h1"
        $background={colorsTokens['primary-100']}
        $margin="none"
        $padding="large"
      >
        {t('Legal notice')}
      </Box>
      <Box $padding={{ horizontal: 'large', vertical: 'big' }}>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Publisher')}
        </Text>
        <Text as="p">
          {t(
            'French Interministerial Directorate for Digital Affairs (DINUM), 20 avenue de Ségur 75007 Paris.',
          )}
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Publication Director')}
        </Text>
        <Text as="p">
          {t('Stéphanie Schaer: Interministerial Digital Director (DINUM).')}
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Copyright')}
        </Text>
        <Text as="p" $display="inline">
          {t('Illustration:')}{' '}
          <Text $weight="bold" $display="inline">
            DINUM
          </Text>
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('More info?')}
        </Text>
        <Text as="p" $display="inline">
          {t(
            'The team in charge of the digital workspace "La Suite numérique" can be contacted directly at',
          )}{' '}
          <TextStyled
            as="a"
            href="mailto:lasuite@modernisation.gouv.fr"
            $display="inline"
          >
            lasuite@modernisation.gouv.fr
          </TextStyled>
          .
        </Text>
      </Box>
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout>{page}</PageLayout>;
};

export default Page;
