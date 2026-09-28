import { Box, BoxType } from '../Box';

export const HorizontalSeparator = (props: BoxType) => {
  return (
    <Box
      role="separator"
      $height="1px"
      $width="100%"
      $margin={{ vertical: 'base' }}
      $background="var(--c--contextuals--border--surface--primary)"
      className="--docs--horizontal-separator"
      {...props}
    />
  );
};
