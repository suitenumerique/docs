import { Box, SeparatedSection } from '@/components';
import { useDocStore } from '@/features/docs';
import { SimpleDocItem } from '@/features/docs/docs-grid/components/SimpleDocItem';

export const LeftPanelDocContent = () => {
  const { currentDoc } = useDocStore();

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
          <SimpleDocItem doc={currentDoc} showAccesses={true} />
        </Box>
      </SeparatedSection>
    </Box>
  );
};
