import { useTranslation } from 'react-i18next';

import { Text, TextType } from '@/components';

type DocIconProps = TextType & {
  emoji?: string | null;
  defaultIcon: React.ReactNode;
};

export const DocIcon = ({
  emoji,
  defaultIcon,
  $size = 'sm',
  $variation = '1000',
  $weight = '400',
  ...textProps
}: DocIconProps) => {
  const { t } = useTranslation();

  if (!emoji) {
    return <>{defaultIcon}</>;
  }

  return (
    <Text
      {...textProps}
      $size={$size}
      $variation={$variation}
      $weight={$weight}
      aria-hidden="true"
      aria-label={t('Document emoji icon')}
    >
      {emoji}
    </Text>
  );
};
