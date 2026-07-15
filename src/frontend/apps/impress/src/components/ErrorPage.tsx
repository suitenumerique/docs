import Head from 'next/head';
import Link from 'next/link';
import { ComponentType, ReactNode, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Icon, Text } from '@/components';
import HomeSvg from '@/icons/house-rounded.svg';

const errorActionStyles = `
  display: flex;
  height: var(--md, 24px);
  padding: 0 var(--xxxs, 4px);
  justify-content: center;
  align-items: center;
  gap: var(--xxxs, 4px);
  color: var(--c--contextuals--content--semantic--neutral--tertiary);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--line-height-xs, 16px);
  text-decoration: none;

  svg {
    text-decoration: none;
  }

  .--docs--error-action-label {
    text-decoration: none;
  }

  &:hover:not(:disabled) .--docs--error-action-label {
    text-decoration: underline;
  }
`;

const ErrorActionLink = styled.button`
  ${errorActionStyles}
`;

const ErrorActionLinkStyled = styled(Link)`
  ${errorActionStyles}
`;

interface ErrorPageProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  refreshTarget?: string;
  showReload?: boolean;
  showHome?: boolean;
  actions?: ReactNode;
}

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

export const ErrorPage = ({
  icon: IconComponent,
  title,
  description,
  refreshTarget,
  showReload,
  showHome = true,
  actions,
}: ErrorPageProps) => {
  const { t } = useTranslation();

  const safeTarget = getSafeRefreshUrl(refreshTarget);

  return (
    <>
      <Head>
        <title>
          {title} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${title} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $justify="center"
        $flex="1"
        $gap="var(--xxxs, 4px)"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h1" $textAlign="center" className="sr-only">
          {title} - {t('Docs')}
        </Text>
        <IconComponent width={102} height={72} aria-hidden="true" />

        <Box $align="center" $gap="0">
          <Text as="p" $weight="bold" $textAlign="center" $margin="0">
            {title}
          </Text>

          <Text
            as="p"
            $textAlign="center"
            $maxWidth="350px"
            $margin="0"
            $css="
              color: var(--c--contextuals--content--semantic--neutral--secondary);
              font-size: 12px;
              font-weight: 400;
              line-height: var(--line-height-xs, 16px);
              margin-top: 4px;
            "
          >
            {description}
          </Text>
        </Box>

        {actions ? (
          <Box
            $direction="row"
            $align="flex-start"
            $gap="0.5rem"
            $css="margin-top: var(--base, 16px);"
          >
            {actions}
          </Box>
        ) : (
          <Box
            $direction="row"
            $align="flex-start"
            $gap="0.5rem"
            $css="margin-top: var(--base, 16px);"
          >
            {showHome && (
              <ErrorActionLinkStyled href="/">
                <HomeSvg width={16} height={16} aria-hidden="true" />
                <span className="--docs--error-action-label">{t('Home')}</span>
              </ErrorActionLinkStyled>
            )}

            {(safeTarget || showReload) && (
              <ErrorActionLink
                onClick={() =>
                  safeTarget
                    ? window.location.assign(safeTarget)
                    : window.location.reload()
                }
              >
                <Icon
                  iconName="refresh"
                  variant="symbols-outlined"
                  $size="16px"
                  $color="inherit"
                />
                <span className="--docs--error-action-label">
                  {t('Refresh page')}
                </span>
              </ErrorActionLink>
            )}
          </Box>
        )}
      </Box>
    </>
  );
};
