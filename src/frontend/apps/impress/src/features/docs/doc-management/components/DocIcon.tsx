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
      data-testid="doc-emoji-icon"
    >
      {emoji}
    </Text>
  );
};
