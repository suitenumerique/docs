import { useTranslation } from 'react-i18next';

import IconDocs from '@/assets/icons/icon-docs.svg';
import { Box, Text } from '@/components';
import { useConfig } from '@/core/config';
import { useCunninghamTheme } from '@/cunningham';
import { ProConnectButton } from '@/features/auth';
import { Title } from '@/features/header';
import { useResponsiveStore } from '@/stores';

export function HomeBottom() {
  const { data: config } = useConfig();
  const withProConnect = config?.theme_customization?.home?.['with-proconnect'];

  if (!withProConnect) {
    return null;
  }

  return <HomeProConnect />;
}

function HomeProConnect() {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const parentGap = '230px';

  return (
    <Box
      $justify="center"
      $height={!isMobile ? `calc(100vh - ${parentGap})` : 'auto'}
      className="--docs--home-proconnect"
    >
      <Box
        $gap={spacingsTokens['md']}
        $direction="column"
        $align="center"
        $margin={{ top: isMobile ? 'none' : `-${parentGap}` }}
      >
        <Box
          $align="center"
          $gap={spacingsTokens['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
          $css="zoom: 1.9;"
          $theme="brand"
        >
          <IconDocs aria-label={t('Docs Logo')} width={34} />
          <Title />
        </Box>
        <Text $size="md" $variation="secondary" $textAlign="center">
          {t('Docs is already available, log in to use it now.')}
        </Text>
        <ProConnectButton />
      </Box>
    </Box>
  );
}
