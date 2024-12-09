import { DateTime } from 'luxon';

import { Box, Icon, Text } from '@/components';
import { QuickSearchItemContent } from '@/components/quick-search/QuickSearchItemContent';
import { Doc } from '@/features/docs/doc-management';
import { SimpleDocItem } from '@/features/docs/docs-grid/components/SimpleDocItem';
import { useResponsiveStore } from '@/stores';

type DocSearchItemProps = {
  doc: Doc;
};

export const DocSearchItem = ({ doc }: DocSearchItemProps) => {
  const { isDesktop } = useResponsiveStore();
  return (
    <div data-testid={`doc-search-item-${doc.id}`}>
      <QuickSearchItemContent
        left={
          <Box $direction="row" $align="center" $gap="10px">
            <Box $flex={isDesktop ? 9 : 1}>
              <SimpleDocItem doc={doc} showAccesses />
            </Box>
            {isDesktop && (
              <Box $flex={2} $justify="center" $align="center">
                <Text $variation="500" $align="right" $size="xs">
                  {DateTime.fromISO(doc.updated_at).toRelative()}
                </Text>
              </Box>
            )}
          </Box>
        }
        right={
          <Icon iconName="keyboard_return" $theme="primary" $variation="800" />
        }
      />
    </div>
  );
};
