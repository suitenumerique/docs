import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

interface DocTagPublicProps {
  doc: Doc;
}

export const DocTagPublic = ({ doc }: DocTagPublicProps) => {
  const { colorsTokens } = useCunninghamTheme();
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();

  if (doc?.link_reach !== LinkReach.PUBLIC) {
    return null;
  }

  return (
    <Text
      $weight="bold"
      $background={colorsTokens()['primary-600']}
      $color="white"
      $padding="xtiny"
      $radius="3px"
      $size="s"
      $position={isSmallMobile ? 'absolute' : 'initial'}
      $css={isSmallMobile ? 'right: 10px;' : ''}
    >
      {t('Public')}
    </Text>
  );
};
