import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import Icon404 from '@/assets/icons/icon-404.svg';
import { Box, Icon, StyledLink, Text } from '@/components';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const StyledButton = styled(Button)`
  width: fit-content;
  padding-left: 2rem;
  padding-right: 2rem;
`;

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>{`${t('Offline', { description: 'Page title when there is no internet connection' })} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}</title>
        <meta
          property="og:title"
          content={`${t('Offline', { description: 'Page title when there is no internet connection' })} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}
          key="title"
        />
      </Head>
      <Box $align="center" $margin="auto" $height="70vh" $gap="2rem">
        <Icon404 aria-label="Image 404" role="img" />

        <Text $size="h2" $weight="700">
          {t('Offline ?!', { description: 'Heading of the offline page' })}
        </Text>

        <Text as="p" $textAlign="center" $maxWidth="400px" $size="m">
          {t("Can't load this page, please check your internet connection.", {
            description: 'Message of the offline page',
          })}
        </Text>

        <Box $margin={{ top: 'large' }}>
          <StyledLink href="/">
            <StyledButton icon={<Icon iconName="house" $color="white" />}>
              {t('Home', {
                description: 'Button/link label to go back to the home page',
              })}
            </StyledButton>
          </StyledLink>
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
