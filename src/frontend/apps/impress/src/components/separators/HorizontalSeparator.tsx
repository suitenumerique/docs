import { Spacings } from '@/utils';

import { Box } from '../Box';

type Props = {
  $withPadding?: boolean;
  customPadding?: Spacings;
};

export const HorizontalSeparator = ({
  $withPadding = true,
  customPadding,
}: Props) => {
  const padding = $withPadding
    ? (customPadding ?? 'base')
    : ('none' as Spacings);

  return (
    <Box
      $height="1px"
      $width="100%"
      $margin={{ vertical: padding }}
      $background="var(--c--contextuals--border--surface--primary)"
      className="--docs--horizontal-separator"
    />
  );
};
