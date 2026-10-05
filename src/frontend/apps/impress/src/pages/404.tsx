import Head from 'next/head';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import Error404Svg from '@/assets/icons/error-404.svg';
import { Box, Icon, StyledLink, Text } from '@/components';
import HomeSvg from '@/icons/house-rounded.svg';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const pageTitle = `${t('Page Not Found - Error 404', { description: 'Page title of the not found error' })} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} key="title" />
      </Head>
      <Box
        $align="center"
        $gap="base"
        $padding={{ horizontal: 'base', bottom: 'lg' }}
        className="--docs--error-404"
      >
        <Box $align="center" $gap="xxxs">
          <Error404Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Error 404', {
              description: 'Heading of the not found error page',
            })}
          </Text>
          <Text
            as="p"
            $textAlign="center"
            $maxWidth="228px"
            $theme="neutral"
            $variation="secondary"
            $margin="0"
            $size="xs"
          >
            {t(
              'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
              { description: 'Message of the not found error page' },
            )}
          </Text>
        </Box>
        <StyledLink
          href="/"
          $css={css`
            display: flex;
            align-items: center;
            flex-direction: row;
            gap: var(--c--globals--spacings--3xs);
            outline: none;
            &:focus-visible {
              outline: 2px solid
                var(--c--contextuals--content--semantic--neutral--tertiary);
              border-radius: 1px;
              outline-offset: var(--c--globals--spacings--st);
            }
          `}
        >
          <Icon
            icon={<HomeSvg width={16} height={16} />}
            $theme="neutral"
            $variation="tertiary"
          />
          <Text
            $size="sm"
            $weight={500}
            $theme="neutral"
            $variation="tertiary"
            $margin="0"
          >
            {t('Home', {
              description: 'Button/link label to go back to the home page',
            })}
          </Text>
        </StyledLink>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
