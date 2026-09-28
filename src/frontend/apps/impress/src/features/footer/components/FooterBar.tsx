import { Box } from '@/components';

import { FooterActions } from './FooterActions';

export const FooterBar = () => {
  return (
    <Box
      as="footer"
      className="--docs--footer-bar"
      $width="fit-content"
      $shrink={0}
      $padding={{ vertical: 'sm' }}
    >
      <FooterActions />
    </Box>
  );
};
