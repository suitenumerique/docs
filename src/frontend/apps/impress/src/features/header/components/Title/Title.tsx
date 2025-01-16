import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

type TitleProps = {
  size?: 'sm' | 'md';
};

const Title = ({ size = 'sm' }: TitleProps) => {
  const { t } = useTranslation();
  const theme = useCunninghamTheme();
  const spacings = theme.spacingsTokens();
  const colors = theme.colorsTokens();

  return (
    <Box
      $direction="row"
      $align="center"
      $gap={size === 'sm' ? spacings['2xs'] : '1.125rem'}
    >
      <Text
        $margin="none"
        as="h2"
        $color="#000091"
        $zIndex={1}
        $size={size === 'sm' ? '1.3rem' : spacings['xxl']}
      >
        {t('Docs')}
      </Text>
      <Text
        $padding={{
          horizontal: size === 'sm' ? '2xs' : 'sm',
          vertical: size === 'sm' ? '3xs' : 'xs',
        }}
        $size={size === 'sm' ? '0.68rem' : spacings['md']}
        $theme="primary"
        $variation="500"
        $weight="bold"
        $radius={size === 'sm' ? '0.75rem' : '1.5rem'}
        $css={css`
          line-height: ${size === 'sm' ? '1rem' : '1.25rem'};
        `}
        $background={colors['primary-200']}
      >
        BETA
      </Text>
    </Box>
  );
};

export default Title;
