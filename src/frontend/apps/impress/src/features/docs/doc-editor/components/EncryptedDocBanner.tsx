import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon } from '@/components';

import { useEncryption } from './EncryptionProvider';

export const EncryptedDocBanner = () => {
  const { t } = useTranslation();
  const { isEncrypted, pendingPlaceholders, requestRevealAll } =
    useEncryption();

  if (!isEncrypted || pendingPlaceholders === 0) {
    return null;
  }

  return (
    <Box
      $direction="row"
      $align="center"
      $justify="flex-end"
      $padding={{ horizontal: '54px', vertical: '3xs' }}
    >
      <Button
        size="small"
        variant="tertiary"
        onClick={requestRevealAll}
        icon={<Icon iconName="visibility" $size="sm" $color="inherit" />}
      >
        {t('Reveal all media')}
      </Button>
    </Box>
  );
};
