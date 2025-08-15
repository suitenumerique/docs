import { Text } from '@/components';

type DocIconProps = {
  emoji?: string | null;
  defaultIcon: React.ReactNode;
  iconSize?: 'sm' | 'lg';
  iconVariation?:
    | '500'
    | '400'
    | 'text'
    | '1000'
    | '000'
    | '100'
    | '200'
    | '300'
    | '600'
    | '700'
    | '800'
    | '900';
  iconWeight?: '400' | '500' | '600' | '700' | '800' | '900';
};

export const DocIcon = ({
  emoji,
  defaultIcon,
  iconSize = 'sm',
  iconVariation = '1000',
  iconWeight = '400',
}: DocIconProps) => {
  if (emoji) {
    return (
      <Text
        $size={iconSize}
        $variation={iconVariation}
        $weight={iconWeight}
        aria-hidden="true"
        aria-label="Document emoji icon"
      >
        {emoji}
      </Text>
    );
  }

  return <>{defaultIcon}</>;
};
