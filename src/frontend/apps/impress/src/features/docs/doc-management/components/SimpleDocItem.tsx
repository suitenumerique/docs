import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, getEmojiAndTitle, useTrans } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import PinnedDocumentIcon from '../assets/pinned-document.svg';
import SimpleFileIcon from '../assets/simple-document.svg';

import { DocIcon } from './DocIcon';

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

  const { emoji, titleWithoutEmoji: displayTitle } = getEmojiAndTitle(
    doc.title || untitledDocument,
  );

  return (
    <Box
      $direction="row"
      $gap={spacingsTokens.sm}
      $overflow="auto"
      $width="100%"
      className="--docs--simple-doc-item"
      role="presentation"
      aria-label={`${t('Open document {{title}}', { title: doc.title || untitledDocument })}`}
    >
      <Box
        $direction="row"
        $align="center"
        $css={css`
          background-color: transparent;
          filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.05));
        `}
        $padding={`${spacingsTokens['3xs']} 0`}
        data-testid={isPinned ? `doc-pinned-${doc.id}` : undefined}
        aria-hidden="true"
      >
        {isPinned ? (
          <PinnedDocumentIcon
            aria-hidden="true"
            data-testid="doc-pinned-icon"
            color={colorsTokens['primary-500']}
          />
        ) : (
          <DocIcon
            emoji={emoji}
            defaultIcon={
              <SimpleFileIcon
                aria-hidden="true"
                data-testid="doc-simple-icon"
                color={colorsTokens['primary-500']}
              />
            }
            $size="25px"
          />
        )}
      </Box>
      <Box $justify="center" $overflow="auto">
        <Text
          $size="sm"
          $variation="1000"
          $weight="500"
          $css={ItemTextCss}
          data-testid="doc-title"
        >
          {displayTitle}
        </Text>
        {(!isDesktop || showAccesses) && (
          <Box
            $direction="row"
            $align="center"
            $gap={spacingsTokens['3xs']}
            $margin={{ top: '-2px' }}
            aria-hidden="true"
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
