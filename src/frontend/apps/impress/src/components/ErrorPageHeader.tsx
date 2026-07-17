import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import DocsTitleSvg from '@/assets/icons/DOCS.svg';
import { Box, StyledLink } from '@/components';
import { useConfig } from '@/core';

export const ErrorPageHeader = () => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const icon = config?.theme_customization?.header?.icon;

  return (
    <Box
      as="header"
      $direction="row"
      $align="center"
      $justify="space-between"
      $width="100%"
      $css={css`
        height: var(--xxl, 48px);
        padding: 0 var(--xs, 8px);
        align-self: stretch;
        border-bottom: 1px solid
          var(--c--contextuals--border--semantic--neutral--default);
      `}
    >
      <StyledLink
        href="/"
        data-testid="header-logo-link"
        aria-label={t('Docs') + ' - ' + t('Home')}
        $css={css`
          padding: var(--xxxs, 4px);
          outline: none;
          &:focus-visible {
            box-shadow: 0 0 0 2px var(--c--globals--colors--brand-400) !important;
            border-radius: var(--c--globals--spacings--st);
          }
        `}
      >
        <Box $align="center" $gap="5px" $direction="row" $height="fit-content">
          {icon && (
            <Image
              data-testid="header-icon-docs"
              width={32}
              height={32}
              priority
              src={icon.src}
              alt=""
              style={{ width: '32px', height: '32px', flexShrink: 0 }}
            />
          )}
          <DocsTitleSvg
            width={50.5}
            height={16}
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          />
        </Box>
      </StyledLink>
    </Box>
  );
};
