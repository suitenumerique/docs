import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export const AlertPublic = ({ isPublicDoc }: { isPublicDoc: boolean }) => {
  const { t } = useTranslation();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();

  return (
    <Box
      aria-label={t('Public document')}
      $color={colorsTokens['primary-800']}
      $background={colorsTokens['primary-050']}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $padding="xs"
      $flex={1}
      $align="center"
      $gap={spacingsTokens['3xs']}
      $css={css`
        border: 1px solid var(--c--theme--colors--primary-300, #e3e3fd);
      `}
    >
      <Icon
        $theme="primary"
        $variation="800"
        data-testid="public-icon"
        iconName={isPublicDoc ? 'public' : 'vpn_lock'}
      />
      <Text $theme="primary" $variation="800" $weight="500">
        {isPublicDoc
          ? t('Public document')
          : t('Document accessible to any connected person')}
      </Text>
    </Box>
  );
};
