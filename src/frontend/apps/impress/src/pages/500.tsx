import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import Error500Svg from '@/assets/icons/error-500.svg';
import { Box, Icon, StyledLink, Text } from '@/components';
import HomeSvg from '@/icons/house-rounded.svg';
import RetrySvg from '@/icons/retry.svg';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const actionCss = css`
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: var(--c--globals--spacings--3xs);
  outline: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  &:focus-visible {
    outline: 2px solid
      var(--c--contextuals--content--semantic--neutral--tertiary);
    border-radius: 1px;
    outline-offset: var(--c--globals--spacings--st);
  }
`;

const getSafeRefreshUrl = (target?: string): string | undefined => {
  if (!target) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    return target.startsWith('/') && !target.startsWith('//')
      ? target
      : undefined;
  }

  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) {
      return undefined;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
};

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const refreshTarget = getSafeRefreshUrl(from);
  const pageTitle = `${t('Error 500')} - ${t('Docs')}`;

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
        className="--docs--error-500"
      >
        <Box $align="center" $gap="xxxs">
          <Error500Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Error 500')}
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
              'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
            )}
          </Text>
        </Box>
        <Box $direction="row" $align="center" $gap="base">
          <StyledLink href="/" $css={actionCss}>
            <Icon
              icon={<HomeSvg width={16} height={16} />}
              $theme="neutral"
              $variation="tertiary"
            />
            <Text
              $size="xs"
              $weight={500}
              $theme="neutral"
              $variation="tertiary"
              $margin="0"
            >
              {t('Home')}
            </Text>
          </StyledLink>
          <Box
            as="button"
            type="button"
            $css={actionCss}
            onClick={() =>
              refreshTarget
                ? window.location.assign(refreshTarget)
                : window.location.reload()
            }
          >
            <Icon
              icon={<RetrySvg width={16} height={16} />}
              $theme="neutral"
              $variation="tertiary"
            />
            <Text
              $size="xs"
              $weight={500}
              $theme="neutral"
              $variation="tertiary"
              $margin="0"
            >
              {t('Refresh page')}
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
