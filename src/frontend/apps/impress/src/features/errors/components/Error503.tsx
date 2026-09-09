import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Icon, Text } from '@/components';

import Error503Svg from '../assets/503.svg';

const getSafeRefreshUrl = (target?: string): string | undefined => {
  if (!target) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    return target.startsWith('/') && !target.startsWith('//')
      ? target
      : undefined;
  }

  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) {
      return undefined;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
};

type Error503Props = {
  refreshTarget?: string;
};

export const Error503 = ({ refreshTarget }: Error503Props) => {
  const { t } = useTranslation();
  const safeTarget = getSafeRefreshUrl(refreshTarget);

  return (
    <Box
      $align="center"
      $gap="xs"
      $padding={{ horizontal: 'base' }}
      className="--docs--error-503"
    >
      <Error503Svg aria-hidden="true" />
      <Box $align="center" $gap="3xs">
        <Text
          as="h1"
          $size="md"
          $weight="bold"
          $textAlign="center"
          $margin="0"
          $theme="neutral"
          $variation="primary"
        >
          {t('Error 503')}
        </Text>
        <Text
          as="p"
          $textAlign="center"
          $maxWidth="330px"
          $theme="neutral"
          $variation="secondary"
          $margin="0"
          $size="sm"
        >
          {t('The server is temporarily overloaded or unavailable')}
        </Text>
      </Box>
      <BoxButton
        $direction="row"
        $align="center"
        $gap="3xs"
        $theme="neutral"
        $variation="tertiary"
        onClick={() =>
          safeTarget
            ? window.location.assign(safeTarget)
            : window.location.reload()
        }
      >
        <Icon
          iconName="refresh"
          variant="symbols-outlined"
          $size="sm"
          $theme="neutral"
          $variation="tertiary"
          aria-hidden="true"
        />
        <Text
          $size="sm"
          $theme="neutral"
          $variation="tertiary"
          $weight={500}
          $margin="0"
        >
          {t('Refresh page')}
        </Text>
      </BoxButton>
    </Box>
  );
};
