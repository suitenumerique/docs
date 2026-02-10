import {
  OnboardingModal,
  type OnboardingModalProps,
} from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';

import { useOnboardingSteps } from '../hooks/useOnboardingSteps';

export interface OnBoardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  footerLink?: OnboardingModalProps['footerLink'];
}

export const OnBoarding = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
  footerLink,
}: OnBoardingProps) => {
  const { t } = useTranslation();

  const steps = useOnboardingSteps();
  const complete = onComplete ?? onClose;

  return (
    <OnboardingModal
      isOpen={isOpen}
      appName={t('Discover Docs')}
      mainTitle={t('Learn the core principles')}
      steps={steps}
      footerLink={footerLink}
      onSkip={onSkip}
      onClose={onClose}
      onComplete={complete}
    />
  );
};
