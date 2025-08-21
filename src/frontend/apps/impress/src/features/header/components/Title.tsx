import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components/';
import { useCunninghamTheme } from '@/cunningham';

type TitleSemanticsProps = {
  headingLevel?: 'h1' | 'h2' | 'h3';
};

export const Title = ({ headingLevel = 'h2' }: TitleSemanticsProps) => {
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
        as={headingLevel}
        $color={colorsTokens['primary-text']}
        $zIndex={1}
        $size="1.375rem"
      >
        {t('Docs')}
      </Text>
    </Box>
  );
};
