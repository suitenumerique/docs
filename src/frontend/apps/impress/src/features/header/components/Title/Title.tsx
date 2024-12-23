import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

const Title = () => {
  const { t } = useTranslation();
  const theme = useCunninghamTheme();
  const spacings = theme.spacingsTokens();
  const colors = theme.colorsTokens();

  return (
    <Box $direction="row" $align="center" $gap={spacings['2xs']}>
      <Text $margin="none" as="h2" $color="#000091" $zIndex={1} $size="1.30rem">
        {t('Docs')}
      </Text>
      <Text
        $padding={{ horizontal: 'xs', vertical: '1px' }}
        $size="11px"
        $theme="primary"
        $variation="500"
        $weight="bold"
        $radius="12px"
        $background={colors['primary-200']}
      >
        BETA
      </Text>
    </Box>
  );
};

export default Title;
