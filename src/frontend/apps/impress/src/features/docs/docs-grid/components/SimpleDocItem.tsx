import { DateTime } from 'luxon';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/features/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import PinnedDocumentIcon from '../assets/pinned-document.svg';
import SimpleFileIcon from '../assets/simple-document.svg';

const ItemTextCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: initial;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`;

type SimpleDocItemProps = {
  doc: Doc;
  isPinned?: boolean;
  showAccesses?: boolean;
};

export const SimpleDocItem = ({
  doc,
  isPinned = false,
  showAccesses = false,
}: SimpleDocItemProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const spacings = spacingsTokens();

  return (
    <Box $direction="row" $gap={spacings.sm}>
      <Box
        $direction="row"
        $align="center"
        $css={css`
          background-color: transparent;
          filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.05));
        `}
      >
        {isPinned ? <PinnedDocumentIcon /> : <SimpleFileIcon />}
      </Box>
      <Box $justify="center">
        <Text
          aria-describedby="doc-title"
          aria-label={doc.title}
          $size="sm"
          $variation="1000"
          $weight="500"
          $css={ItemTextCss}
        >
          {doc.title}
        </Text>
        {(!isDesktop || showAccesses) && (
          <Box
            $direction="row"
            $align="center"
            $gap={spacings['3xs']}
            $margin={{ top: '-2px' }}
          >
            <Text $variation="600" $size="xs">
              {DateTime.fromISO(doc.updated_at).toRelative()}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
