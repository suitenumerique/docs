import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import HomeSvg from '@/icons/house-rounded.svg';
import RetrySvg from '@/icons/retry.svg';

import { Box } from './Box';
import { Icon } from './Icon';
import { StyledLink } from './Link';
import { Text } from './Text';

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

interface ErrorPageProps {
  illustration: ReactNode;
  title: string;
  description: string;
  refreshTarget?: string;
}

export const ErrorPage = ({
  illustration,
  title,
  description,
  refreshTarget,
}: ErrorPageProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const pageTitle = `${title} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`;

  const handleRefresh = () => {
    const safeTarget = getSafeRefreshUrl(refreshTarget);
    if (!safeTarget) {
      window.location.reload();
      return;
    }
    void router.replace(safeTarget);
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} key="title" />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="base"
        $padding={{ horizontal: 'base', bottom: 'lg' }}
        className="--docs--error-page"
      >
        <Box $align="center" $gap="xxxs">
          {illustration}
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {title}
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
            {description}
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
              {t('Home', {
                description: 'Button/link label to go back to the home page',
              })}
            </Text>
          </StyledLink>
          <Box
            as="button"
            type="button"
            $css={actionCss}
            onClick={handleRefresh}
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
              {t('Refresh page', {
                description: 'Button on the error page to reload the page',
              })}
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
};
