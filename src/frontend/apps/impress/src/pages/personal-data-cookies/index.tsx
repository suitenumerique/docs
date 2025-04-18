import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
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
        {t('Personal data and cookies')}
      </Box>
      <Box $padding={{ horizontal: 'large', vertical: 'big' }}>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('Cookies placed')}
        </Text>
        <Text as="p">
          {t(
            'This site places a small text file (a "cookie") on your computer when you visit it.',
          )}
          {t(
            'This allows us to measure the number of visits and understand which pages are the most viewed.',
          )}
        </Text>
        <Text as="p">
          {t('You can oppose the tracking of your browsing on this website.')}
          {t(
            'This will protect your privacy, but will also prevent the owner from learning from your actions and creating a better experience for you and other users.',
          )}
        </Text>
        <Text as="h2" $margin={{ bottom: 'xtiny' }}>
          {t('This site does not display a cookie consent banner, why?')}
        </Text>
        <Text as="p">
          {t(
            "It's true, you didn't have to click on a block that covers half the page to say you agree to the placement of cookies — even if you don't know what it means!",
          )}
        </Text>
        <Text as="p">
          {t(
            'Nothing exceptional, no special privileges related to a .gouv.fr.',
          )}
          {t(
            'We simply comply with the law, which states that certain audience measurement tools, properly configured to respect privacy, are exempt from prior authorization.',
          )}
        </Text>
      </Box>
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout>{page}</PageLayout>;
};

export default Page;
