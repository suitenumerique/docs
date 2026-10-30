import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import Error502Svg from '@/assets/icons/error-502.svg';
import { Box, Icon, Text } from '@/components';
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

const SAFE_RELATIVE_PATH = /^\/(?!\/)[\w\-.~%!$&'()*+,;=:@/?#[\]]*$/;

const getSafeRefreshUrl = (target?: string): string | undefined => {
  if (!target || !SAFE_RELATIVE_PATH.test(target)) {
    return undefined;
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
  const { query, push } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const pageTitle = `${t('Offline', {
    description: 'Page title when there is no internet connection',
  })} - ${t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  })}`;

  const handleRefresh = () => {
    const refreshTarget = getSafeRefreshUrl(from);
    if (!refreshTarget) {
      window.location.reload();
      return;
    }
    void push(refreshTarget);
  };

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
        className="--docs--error-502"
      >
        <Box $align="center" $gap="xxxs">
          <Error502Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Offline ?!', { description: 'Heading of the offline page' })}
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
            {t("Can't load this page, please check your internet connection.", {
              description: 'Message of the offline page',
            })}
          </Text>
        </Box>
        <Box as="button" type="button" $css={actionCss} onClick={handleRefresh}>
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
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
