import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

export const Title = () => {
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

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
    </Box>
  );
};
