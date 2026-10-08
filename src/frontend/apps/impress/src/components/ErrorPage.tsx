import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import HomeSvg from '@/icons/house-rounded.svg';
import RetrySvg from '@/icons/retry.svg';
import { isSafeRelativePath } from '@/utils/url';

import { Box } from './Box';
import { ButtonLink } from './Link';
import { Text } from './Text';

const ACTION_ICON_SIZE = 16;

const getSafeRefreshUrl = (target?: string): string | undefined => {
  if (!target || !isSafeRelativePath(target)) {
    return undefined;
  }

  const url = new URL(target, window.location.origin);
  return url.pathname + url.search + url.hash;
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
  const pageTitle = `${title} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`;

  const handleRefresh = () => {
    const safeTarget = getSafeRefreshUrl(refreshTarget);
    if (!safeTarget) {
      window.location.reload();
      return;
    }
    window.location.assign(safeTarget);
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
        <Box $direction="row" $align="center" $gap="xs">
          <ButtonLink
            href="/"
            color="neutral"
            variant="tertiary"
            size="nano"
            icon={
              <HomeSvg
                width={ACTION_ICON_SIZE}
                height={ACTION_ICON_SIZE}
                aria-hidden="true"
              />
            }
          >
            {t('Home', {
              description: 'Button/link label to go back to the home page',
            })}
          </ButtonLink>
          <Button
            color="neutral"
            variant="tertiary"
            size="nano"
            icon={
              <RetrySvg
                width={ACTION_ICON_SIZE}
                height={ACTION_ICON_SIZE}
                aria-hidden="true"
              />
            }
            onClick={handleRefresh}
          >
            {t('Refresh page', {
              description: 'Button on the error page to reload the page',
            })}
          </Button>
        </Box>
      </Box>
    </>
  );
};
