import {
  ModalSize,
  OnboardingModal,
  type OnboardingModalProps,
} from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { useConfig } from '@/core/config/api/useConfig';

import { useOnboardingSteps } from '../hooks/useOnboardingSteps';

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

type OnBoardingProps = {
  isOpen: boolean;
  onClose: () => void;
} & Partial<OnboardingModalProps>;

export const OnBoarding = (props: OnBoardingProps) => {
  const { t } = useTranslation();
  const { steps } = useOnboardingSteps();
  const { data: config } = useConfig();
  const learnMoreUrl =
    config?.theme_customization?.onboarding?.learn_more_url?.trim();

  return (
    <>
      {props.isOpen ? <OnBoardingStyle /> : null}
      <OnboardingModal
        size={ModalSize.LARGE}
        appName={t('Discover Docs')}
        mainTitle={t('Learn the core principles')}
        steps={steps}
        footerLink={
          learnMoreUrl
            ? {
                label: t('Learn more docs features'),
                href: learnMoreUrl,
              }
            : undefined
        }
        onSkip={props.onClose}
        onComplete={props.onClose}
        {...props}
      />
    </>
  );
};
