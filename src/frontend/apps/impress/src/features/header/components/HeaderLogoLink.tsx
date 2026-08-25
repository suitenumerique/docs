import Image from 'next/image';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';

type HeaderLogoLinkProps = {
  /**
   * Heading level of the "Docs" wordmark. Left undefined on pages owning their
   * own h1, so the logo does not compete with the page title.
   */
  headingLevel?: 'h1' | 'h2' | 'h3';
};

export const HeaderLogoLink = ({ headingLevel }: HeaderLogoLinkProps) => {
  const { data: config } = useConfig();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const icon = config?.theme_customization?.header?.icon;

  return (
    <StyledLink
      href="/"
      data-testid="header-logo-link"
      className="--docs--header-logo-link"
      $css={css`
        outline: none;
        &:focus-visible {
          box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
          border-radius: ${spacingsTokens['st']};
        }
      `}
    >
      <Box
        $align="center"
        $gap="4xs"
        $direction="row"
        $position="relative"
        $height="fit-content"
        $margin={{ top: 'auto' }}
      >
        {icon && (
          <Image
            data-testid="header-icon-docs"
            width={0}
            height={0}
            priority
            {...(({ withTitle: _, ...rest }) => rest)(icon)}
          />
        )}
        <Title
          as={headingLevel ?? 'span'}
          className={icon?.withTitle ? undefined : 'sr-only'}
          $size="1.7rem"
          $weight="bold"
        />
      </Box>
    </StyledLink>
  );
};
