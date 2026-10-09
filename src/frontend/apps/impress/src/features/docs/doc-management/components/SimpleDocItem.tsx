import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useDate } from '@/hooks/useDate';
import DocsIcon from '@/icons/Docs.svg';
import SubdocsIcon from '@/icons/Subdocs.svg';
import ArrowIcon from '@/icons/arrow-corner-down-right.svg';
import { useResponsiveStore } from '@/stores';

import { useDocUtils, useTrans } from '../hooks';
import { Doc } from '../types';
import { getEmojiAndTitle } from '../utils';

const ItemTextCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: initial;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  justify-content: center;
`;

type SimpleDocItemProps = {
  doc: Doc;
  breadcrumb?: string;
  showDate?: boolean;
};

export const SimpleDocItem = ({
  doc,
  showDate = false,
  breadcrumb,
}: SimpleDocItemProps) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();
  const { untitledDocument } = useTrans();
  const { isChild } = useDocUtils(doc);
  const { relativeDate, formatDate } = useDate();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title || '');
  const docTitle = titleWithoutEmoji || untitledDocument;
  const docRelativeUpdate = relativeDate(doc.updated_at);
  const itemAriaLabel = `${t('Open document {{title}}', { title: docTitle })}. ${t(
    'Last update: {{update}}',
    {
      update: formatDate(doc.updated_at),
    },
  )}`;

  return (
    <Box
      $direction="row"
      $gap={isSmallMobile ? 'xs' : 'sm'}
      $overflow="auto"
      $width="100%"
      className="--docs--simple-doc-item"
      aria-label={itemAriaLabel}
    >
      {isChild ? (
        <Icon
          icon={
            <SubdocsIcon
              width={isSmallMobile ? '35px' : '40px'}
              height={isSmallMobile ? '35px' : '40px'}
              aria-hidden="true"
              data-testid="doc-child-icon"
              color="var(--c--contextuals--content--semantic--info--tertiary)"
            />
          }
          $shrink="0"
        />
      ) : (
        <Icon
          icon={
            <DocsIcon
              width={isSmallMobile ? '35px' : '40px'}
              height={isSmallMobile ? '35px' : '40px'}
              aria-hidden="true"
              data-testid="doc-simple-icon"
              color="var(--c--contextuals--content--semantic--info--tertiary)"
            />
          }
          $shrink="0"
        />
      )}
      <Box $justify="center" $overflow="auto" $gap="4xs">
        <Text
          $size="sm"
          $weight="500"
          $css={ItemTextCss}
          data-testid="doc-title"
          title={docTitle}
        >
          {emoji && <span aria-hidden="true">{emoji} </span>}
          {docTitle}
        </Text>

        {(showDate || breadcrumb) && (
          <Box
            $direction={isSmallMobile ? 'column' : 'row'}
            $align={isSmallMobile ? 'flex-start' : 'center'}
            aria-hidden="true"
          >
            {breadcrumb && (
              <Box $direction="row" $align="center" $gap="3xs">
                <ArrowIcon
                  width="16px"
                  height="16px"
                  aria-hidden="true"
                  color="var(--c--contextuals--content--semantic--neutral--tertiary)"
                />
                <Text $size="xs" $variation="tertiary" $css={ItemTextCss}>
                  {breadcrumb}
                </Text>
              </Box>
            )}
            {breadcrumb && showDate && !isSmallMobile && (
              <Text $size="xs" $variation="tertiary">
                &nbsp;·&nbsp;
              </Text>
            )}
            {showDate && (
              <Text $size="xs" $variation="tertiary" $shrink="0">
                {docRelativeUpdate}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
