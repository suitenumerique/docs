import { createReactBlockSpec } from '@blocknote/react';

import { Box, Text } from '@/components';

import Loader from '../../assets/loader.svg';
import Warning from '../../assets/warning.svg';

export const UploadLoaderBlock = createReactBlockSpec(
  {
    type: 'uploadLoader',
    propSchema: {
      information: { default: '' as const },
      type: {
        default: 'loading' as const,
        values: ['loading', 'warning'] as const,
      },
    },
    content: 'none',
  },
  {
    render: ({ block }) => {
      return (
        <Box className="bn-visual-media-wrapper" $direction="row" $gap="0.5rem">
          {block.props.type === 'warning' ? (
            <Warning />
          ) : (
            <Loader style={{ animation: 'spin 1.5s linear infinite' }} />
          )}
          <Text>{block.props.information}</Text>
        </Box>
      );
    },
  },
);
