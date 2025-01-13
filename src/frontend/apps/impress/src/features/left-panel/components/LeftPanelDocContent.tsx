import { css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useDocStore } from '@/features/docs/doc-management';
import { SimpleDocItem } from '@/features/docs/docs-grid';

export const LeftPanelDocContent = () => {
  const { currentDoc } = useDocStore();
  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();
  if (!currentDoc) {
    return null;
  }

  return (
    <Box
      $flex={1}
      $width="100%"
      $css="width: 100%; overflow-y: auto; overflow-x: hidden;"
    >
      <SeparatedSection showSeparator={false}>
        <Box $padding={{ horizontal: 'sm' }}>
          <Box
            $css={css`
              padding: ${spacing['2xs']};
              border-radius: 4px;
              background-color: var(--c--theme--colors--greyscale-100);
            `}
          >
            <SimpleDocItem doc={currentDoc} showAccesses={true} />
          </Box>
        </Box>
      </SeparatedSection>
    </Box>
  );
};
