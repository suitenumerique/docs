import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

export const Title = () => {
  const { t } = useTranslation();
  const theme = useCunninghamTheme();
  const spacings = theme.spacingsTokens();

  return (
    <Box
      $direction="row"
      $align="center"
      $gap={spacings['2xs']}
      className="--docs--title"
    >
      <Text
        $margin="none"
        as="h2"
        $color="#000091"
        $zIndex={1}
        $size="1.375rem"
      >
        {t('Docs')}
      </Text>
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
    </Box>
  );
};
