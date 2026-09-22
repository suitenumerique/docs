import { SeparatedSection } from '@/components';
import { ButtonLogin } from '@/features/auth';
import { FooterActions } from '@/features/footer';

export const LeftPanelFooter = () => {
  return (
    <SeparatedSection showSeparator="top" $margin={{ top: 'auto' }}>
      <FooterActions loginAction={<ButtonLogin />} />
    </SeparatedSection>
  );
};
