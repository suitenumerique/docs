import { SeparatedSection } from '@/components';
import { FooterActions } from '@/features/footer';

export const LeftPanelFooter = () => {
  return (
    <SeparatedSection showSeparator="top" $margin={{ top: 'auto' }}>
      <FooterActions isHelpMenuAside />
    </SeparatedSection>
  );
};
