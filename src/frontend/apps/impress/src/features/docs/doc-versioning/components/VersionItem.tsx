import { useState } from 'react';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/features/docs/doc-management';

import { Versions } from '../types';

import { ModalConfirmationVersion } from './ModalConfirmationVersion';

interface VersionItemProps {
  docId: Doc['id'];
  text: string;

  versionId?: Versions['version_id'];
  isActive: boolean;
}

export const VersionItem = ({
  docId,
  versionId,
  text,

  isActive,
}: VersionItemProps) => {
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  const [isModalVersionOpen, setIsModalVersionOpen] = useState(false);

  return (
    <>
      <Box
        $width="100%"
        as="li"
        $background={isActive ? colorsTokens()['greyscale-100'] : 'transparent'}
        $radius={spacing['3xs']}
        $css={`
          cursor: pointer;

          &:hover {
            background: ${colorsTokens()['greyscale-100']};
          }
        `}
        $hasTransition
        $minWidth="13rem"
      >
        <Box
          $padding={{ vertical: '0.7rem', horizontal: 'small' }}
          $align="center"
          $direction="row"
          $justify="space-between"
          $width="100%"
        >
          <Box $direction="row" $gap="0.5rem" $align="center">
            <Text $weight="bold" $size="sm" $variation="1000">
              {text}
            </Text>
          </Box>
        </Box>
      </Box>
      {isModalVersionOpen && versionId && (
        <ModalConfirmationVersion
          onClose={() => setIsModalVersionOpen(false)}
          docId={docId}
          versionId={versionId}
        />
      )}
    </>
  );
};
