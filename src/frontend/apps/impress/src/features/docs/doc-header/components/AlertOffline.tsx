import { useTranslation } from 'react-i18next';

import { Box, Card, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export const AlertOffline = () => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Card
      className="--docs--alert-offline"
      aria-label={t('Alert offline document')}
      $radius={spacingsTokens['3xs']}
      $padding="xs"
      $flex={1}
      $gap="3xs"
      $justify="space-between"
      $theme="warning"
    >
      <Box $withThemeInherited $direction="row" $align="center" $gap="2xs">
        <Icon
          $withThemeInherited
          iconName="android_wifi_4_bar_off"
          variant="symbols-outlined"
          $shrink="0"
        />
        <Text $theme="warning">
          {t(
            "You're offline. You can keep editing, and your changes will sync automatically once you're back online.",
          )}
        </Text>
      </Box>
    </Card>
  );
};
