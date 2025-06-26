import { useCunninghamTheme } from '@/cunningham';
import { Spacings } from '@/utils';

import { Box } from '../Box';

export enum SeparatorVariant {
  LIGHT = 'light',
  DARK = 'dark',
}

type Props = {
  variant?: SeparatorVariant;
  $withPadding?: boolean;
  customPadding?: Spacings;
};

export const HorizontalSeparator = ({
  variant = SeparatorVariant.LIGHT,
  $withPadding = true,
  customPadding,
}: Props) => {
  const { colorsTokens } = useCunninghamTheme();

  const padding = $withPadding
    ? (customPadding ?? 'base')
    : ('none' as Spacings);

  return (
    <Box
      $height="1px"
      $width="100%"
      $margin={{ vertical: padding }}
      $background={
        variant === SeparatorVariant.DARK
          ? '#e5e5e533'
          : colorsTokens['greyscale-100']
      }
      className="--docs--horizontal-separator"
    />
  );
};
