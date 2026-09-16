import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import HomeSvg from '@/icons/house-rounded.svg';

import Error404Svg from '../assets/404.svg';

export const Error404 = () => {
  const { t } = useTranslation();

  return (
    <Box
      $align="center"
      $gap="xs"
      $padding={{ horizontal: 'base' }}
      className="--docs--error-404"
    >
      <Error404Svg aria-hidden="true" />
      <Box $align="center" $gap="3xs">
        <Text
          as="h1"
          $size="md"
          $weight="bold"
          $textAlign="center"
          $margin="0"
          $theme="neutral"
          $variation="primary"
        >
          {t('Error 404')}
        </Text>
        <Text
          as="p"
          $textAlign="center"
          $maxWidth="330px"
          $theme="neutral"
          $variation="secondary"
          $margin="0"
          $size="sm"
        >
          {t(
            'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
          )}
        </Text>
      </Box>
      <StyledLink
        href="/"
        $css={css`
          outline: none;
          &:hover .--docs--error-404-home-label {
            text-decoration: underline;
          }
          &:focus-visible {
            outline: 2px solid
              var(--c--contextuals--content--semantic--neutral--tertiary);
            border-radius: 1px;
            outline-offset: var(--c--globals--spacings--st);
          }
        `}
      >
        <Box $direction="row" $align="center" $gap="3xs">
          <Icon
            icon={<HomeSvg width={16} height={16} />}
            $theme="neutral"
            $variation="tertiary"
          />
          <Text
            className="--docs--error-404-home-label"
            $size="sm"
            $weight={500}
            $theme="neutral"
            $variation="tertiary"
            $margin="0"
          >
            {t('Home')}
          </Text>
        </Box>
      </StyledLink>
    </Box>
  );
};
