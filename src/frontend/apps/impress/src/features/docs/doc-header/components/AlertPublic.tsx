import { useTranslation } from 'react-i18next';

import { Card, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export const AlertPublic = ({ isPublicDoc }: { isPublicDoc: boolean }) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Card
      aria-label={t('Public document')}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $padding="xs"
      $flex={1}
      $align="center"
      $gap={spacingsTokens['2xs']}
      $theme="brand"
    >
      <Icon
        $withThemeInherited
        data-testid="public-icon"
        iconName={isPublicDoc ? 'public' : 'vpn_lock'}
      />
      <Text $withThemeInherited $weight="500">
        {isPublicDoc
          ? t('Public document')
          : t('Document accessible to any connected person')}
      </Text>
    </Card>
  );
};
