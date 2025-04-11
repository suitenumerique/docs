import { ReactElement } from 'react';
import { Trans, useTranslation } from 'react-i18next';

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
        {t('Accessibility')}
      </Box>
      <Box $padding={{ horizontal: 'large', vertical: 'big' }}>
        <Text as="p" $display="inline">
          <Trans t={t} i18nKey="accessibility-dinum-services">
            <strong>DINUM</strong> is committed to making its digital services
            accessible, in accordance with article 47 of French law n° 2005-102
            dated February 11, 2005.
          </Trans>
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Accessibility statement')}
        </Text>
        <Text as="p">{t('Established on December 20, 2023.')}</Text>
        <Text as="p" $display="inline">
          {t('This accessibility statement applies to the site hosted on')}{' '}
          <strong>https://docs.numerique.gouv.fr</strong>.
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Compliance status')}
        </Text>
        <Text as="p" $display="inline">
          <Trans t={t} i18nKey="accessibility-not-audit">
            <strong>https://docs.numerique.gouv.fr</strong> is not compliant
            with RGAA 4.1. The site has <strong>not yet been audited.</strong>
          </Trans>
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Improvement and contact')}
        </Text>
        <Text as="p" $display="inline">
          {t(
            'If you are unable to access a content or a service, you can contact the person responsible for https://lasuite.numerique.gouv.fr to be directed to an accessible alternative or to obtain the content in another form.',
          )}
        </Text>
        <Text as="p" $display="inline">
          <li>
            {t('E-mail:')}{' '}
            <TextStyled
              as="a"
              href="mailto:lasuite@modernisation.gouv.fr"
              $display="inline"
            >
              lasuite@modernisation.gouv.fr
            </TextStyled>
          </li>
          <li>
            {t('Address:')} <strong>DINUM</strong>, 20 avenue de Ségur 75007
            Paris
          </li>
        </Text>
        <Text as="p" $display="inline">
          {t('We try to respond within 2 working days.')}
        </Text>

        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Remedies')}
        </Text>
        <Text as="p" $display="inline">
          {t('This procedure should be used in the following case:')}{' '}
          {t(
            'you have reported to the website manager a lack of accessibility that prevents you from accessing content or one of the services of the portal and you have not received a satisfactory response.',
          )}
        </Text>
        <Text as="p" $display="inline" $margin={{ bottom: 'tiny' }}>
          {t('You can:')}
        </Text>
        <Text as="p" $display="inline" $margin={{ top: 'tiny' }}>
          <li>
            <Trans t={t} i18nKey="accessibility-form-defenseurdesdroits">
              Write a message to the
              <TextStyled
                as="a"
                href="https://formulaire.defenseurdesdroits.fr/formulaire_saisine/"
                $display="inline"
                $margin={{ left: '4px' }}
              >
                Defender of Rights
              </TextStyled>
            </Trans>
          </li>
          <li>
            <Trans t={t} i18nKey="accessibility-contact-defenseurdesdroits">
              Contact the delegate of the
              <TextStyled
                as="a"
                href="https://www.defenseurdesdroits.fr/carte-des-delegues"
                $display="inline"
                $margin={{ left: '4px' }}
              >
                Defender of Rights in your region
              </TextStyled>
            </Trans>
          </li>
          <li>
            {t('Send a letter by post (free of charge, no stamp needed):')}{' '}
            <strong>
              {t(
                'Defender of Rights - Free response - 71120 75342 Paris CEDEX 07',
              )}
            </strong>
          </li>
        </Text>
      </Box>
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout>{page}</PageLayout>;
};

export default Page;
