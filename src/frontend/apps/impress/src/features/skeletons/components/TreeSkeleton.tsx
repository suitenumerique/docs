import { Box } from '@/components';

import { SkeletonLine } from './SkeletionUI';

export const TreeSkeleton = () => {
  return (
    <Box className="--docs--tree-skeleton">
      <SkeletonLine
        $width="92%"
        $height="40px"
        $margin={{ left: 'sm', top: 'sm' }}
      />
      <SkeletonLine
        $width="92%"
        $height="30px"
        $margin={{ left: 'sm', top: 'sm' }}
      />
      <SkeletonLine
        $width="92%"
        $height="30px"
        $margin={{ left: 'sm', top: 'sm' }}
      />
      <SkeletonLine
        $width="92%"
        $height="30px"
        $margin={{ left: 'sm', top: 'sm' }}
      />
    </Box>
  );
};
