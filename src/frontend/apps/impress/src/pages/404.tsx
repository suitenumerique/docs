import { Button } from '@gouvfr-lasuite/cunningham-react';
import Head from 'next/head';
import Image from 'next/image';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import error_img from '@/assets/icons/error-planetes.png';
import { Box, Icon, StyledLink, Text } from '@/components';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const StyledButton = styled(Button)`
  width: fit-content;
`;

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>
          {t('Page Not Found - Error 404')} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${t('Page Not Found - Error 404')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="md"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h1" $textAlign="center" className="sr-only">
          {t('Page Not Found - Error 404')} - {t('Docs')}
        </Text>
        <Image
          src={error_img}
          alt=""
          width={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />

        <Text
          as="p"
          $textAlign="center"
          $maxWidth="350px"
          $theme="neutral"
          $margin="0"
        >
          {t(
            'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
          )}
        </Text>

        <Box $direction="row" $gap="sm">
          <StyledLink href="/">
            <StyledButton
              color="neutral"
              icon={
                <Icon
                  iconName="house"
                  variant="symbols-outlined"
                  $withThemeInherited
                />
              }
            >
              {t('Home')}
            </StyledButton>
          </StyledLink>
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
