import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, useTrans } from '@/docs/doc-management';
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
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { untitledDocument } = useTrans();

  return (
    <Box
      $direction="row"
      $gap={spacingsTokens.sm}
      $overflow="auto"
      className="--docs--simple-doc-item"
    >
      <Box
        $direction="row"
        $align="center"
        $css={css`
          background-color: transparent;
          filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.05));
        `}
        $padding={`${spacingsTokens['3xs']} 0`}
      >
        {isPinned ? (
          <PinnedDocumentIcon
            aria-label={t('Pin document icon')}
            color={colorsTokens['primary-500']}
          />
        ) : (
          <SimpleFileIcon
            aria-label={t('Simple document icon')}
            color={colorsTokens['primary-500']}
          />
        )}
      </Box>
      <Box $justify="center" $overflow="auto">
        <Text
          aria-describedby="doc-title"
          aria-label={doc.title}
          $size="sm"
          $variation="1000"
          $weight="500"
          $css={ItemTextCss}
        >
          {doc.title || untitledDocument}
        </Text>
        {(!isDesktop || showAccesses) && (
          <Box
            $direction="row"
            $align="center"
            $gap={spacingsTokens['3xs']}
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
