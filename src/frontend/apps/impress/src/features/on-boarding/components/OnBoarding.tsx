import {
  ModalSize,
  OnboardingModal,
  type OnboardingModalProps,
} from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { useOnboardingSteps } from '../hooks/useOnboardingSteps';

export interface OnBoardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  footerLink?: OnboardingModalProps['footerLink'];
  size?: ModalSize;
}

const OnBoardingStyle = createGlobalStyle`
  .c__onboarding-modal__steps{
    height: auto;
  }
  .c__onboarding-modal__content {
    height: 350px;
  }

  .c__onboarding-modal__steps {
    gap: var(--c--globals--spacings--sm);
  }

  .c__modal__scroller {
    overflow-x: hidden;
  }

  /* Uniform font for onboarding modal */
  .c__modal:has(.c__onboarding-modal__steps),
  .c__modal:has(.c__onboarding-modal__steps)
    *:not(.material-icons):not(.material-icons-filled):not(
      .material-symbols-outlined
    ) {
    font-family: Marianne, Inter, Roboto Flex Variable, sans-serif;
  }

  /* Separator between content and footer actions/link */
  .c__modal__footer {
    position: relative;
    border-top: 0;
    padding-top: var(--c--globals--spacings--md);
  }

  .c__modal__footer::before {
    content: '';
    position: absolute;
    inset: 0 calc(-1 * var(--c--globals--spacings--xl)) auto;
    height: 1px;
    background-color: var(--c--contextuals--border--surface--primary);
  }

`;

export const OnBoarding = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
  footerLink,
  size = ModalSize.LARGE,
}: OnBoardingProps) => {
  const { t } = useTranslation();

  const { steps } = useOnboardingSteps();
  const complete = onComplete ?? onClose;

  return (
    <>
      {isOpen ? <OnBoardingStyle /> : null}
      <OnboardingModal
        isOpen={isOpen}
        size={size}
        appName={t('Discover Docs')}
        mainTitle={t('Learn the core principles')}
        steps={steps}
        footerLink={footerLink}
        onSkip={onSkip}
        onClose={onClose}
        onComplete={complete}
      />
    </>
  );
};
