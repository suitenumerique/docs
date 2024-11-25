import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';

export enum SeparatorVariant {
  LIGHT = 'light',
  DARK = 'dark',
}

type Props = {
  variant?: SeparatorVariant;
};

export const HorizontalSeparator = ({
  variant = SeparatorVariant.LIGHT,
}: Props) => {
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $height="1px"
      $width="100%"
      $margin={{ vertical: 'base' }}
      $background={
        variant === SeparatorVariant.DARK
          ? '#e5e5e533'
          : colorsTokens()['greyscale-100']
      }
    />
  );
};
