import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

export const Title = () => {
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens, componentTokens } =
    useCunninghamTheme();
  const isBeta = componentTokens['beta'];

  return (
    <Box
      $direction="row"
      $align="center"
      $gap={spacingsTokens['2xs']}
      className="--docs--title"
    >
      <Text
        $margin="none"
        as="h2"
        $color={colorsTokens['primary-text']}
        $zIndex={1}
        $size="1.375rem"
      >
        {t('Docs')}
      </Text>
      {isBeta && (
        <Text
          $padding={{
            horizontal: '6px',
            vertical: '4px',
          }}
          $size="11px"
          $theme="primary"
          $variation="500"
          $weight="bold"
          $radius="12px"
          $css={css`
            line-height: 9px;
          `}
          $width="40px"
          $height="16px"
          $background="#ECECFF"
          $color="#5958D3"
        >
          BETA
        </Text>
      )}
    </Box>
  );
};
