import { Box, SeparatedSection } from '@/components';
import { Waffle } from '@/components/Waffle';
import { ButtonLogin } from '@/features/auth';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

export const LeftPanelFooter = () => {
  const { isLargeScreen } = useResponsiveStore();

  return (
    <SeparatedSection showSeparator="top">
      <Box
        $padding={{ horizontal: 'sm' }}
        $justify="space-between"
        $direction="row"
      >
        <Box $direction="row">
          <Waffle />
          {!isLargeScreen && (
            <>
              <ButtonLogin />
              <LanguagePicker />
            </>
          )}
        </Box>
        <HelpMenu />
      </Box>
    </SeparatedSection>
  );
};
