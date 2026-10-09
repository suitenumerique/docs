import { useTreeContext } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import DocIcon from '@/assets/icons/ui-kit/doc.svg';
import ArrowIcon from '@/assets/icons/ui-kit/keyboard_return.svg';
import { Box } from '@/components/Box';
import { Text } from '@/components/Text';
import { QuickSearchItemContent } from '@/components/quick-search/QuickSearchItemContent';
import { DocSearchContent } from '@/docs/doc-search';
import { type DocSearch } from '@/docs/doc-search/api/useSearchDocs';
import { useTrans } from '@/features/docs/doc-management/hooks/useTrans';
import { type Doc } from '@/features/docs/doc-management/types';
import { getEmojiAndTitle } from '@/features/docs/doc-management/utils';

import { type MentionedInlineContent } from '../types';

interface InterlinkingSearchGroupProps {
  search: string;
  onPick: (inlineContent: MentionedInlineContent) => void;
  /** Separate the docs from the section above. */
  withSeparator?: boolean;
  onResults?: (results: DocSearch[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export const InterlinkingSearchGroup = ({
  search,
  onPick,
  withSeparator,
  onResults,
  onLoadingChange,
}: InterlinkingSearchGroupProps) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const treeContext = useTreeContext<Doc>();

  return (
    <>
      {withSeparator && (
        <Box
          role="separator"
          $margin={{ vertical: 'xxs' }}
          $css={css`
            border-top: 1px solid
              var(--c--contextuals--border--surface--primary);
          `}
        />
      )}
      <DocSearchContent
        groupName={t('Link a doc')}
        hideGroupNameWhenEmpty
        onResults={onResults}
        onLoadingChange={onLoadingChange}
        search={search}
        parentDocId={treeContext?.root?.id}
        isSearchNotMandatory
        onSelect={(doc) => {
          onPick({
            type: 'interlinkingLinkInline',
            props: { docId: doc.id },
          });
        }}
        renderSearchElement={(doc) => {
          const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
            doc.title || untitledDocument,
          );

          return (
            <QuickSearchItemContent
              left={
                <Box
                  $direction="row"
                  $gap="0.2rem"
                  $align="center"
                  $padding={{
                    vertical: '0.5rem',
                    horizontal: '0.2rem',
                  }}
                  $width="100%"
                >
                  <Box
                    $css={css`
                      width: 24px;
                      flex-shrink: 0;
                    `}
                  >
                    {emoji ? (
                      <Text $size="18px">{emoji}</Text>
                    ) : (
                      <DocIcon
                        aria-hidden="true"
                        width="24px"
                        height="24px"
                        color="var(--c--contextuals--content--semantic--neutral--primary)"
                      />
                    )}
                  </Box>

                  <Text
                    $size="sm"
                    $color="var(--c--contextuals--content--semantic--neutral--primary)"
                    spellCheck="false"
                    $weight="500"
                  >
                    {titleWithoutEmoji}
                  </Text>
                </Box>
              }
              right={
                <ArrowIcon
                  aria-hidden="true"
                  width="24px"
                  height="24px"
                  color="var(--c--contextuals--content--semantic--neutral--tertiary)"
                />
              }
            />
          );
        }}
      />
    </>
  );
};
