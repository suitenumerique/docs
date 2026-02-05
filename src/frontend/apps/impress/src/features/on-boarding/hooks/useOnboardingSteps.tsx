import { type OnboardingStep } from '@gouvfr-lasuite/ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import DragIndicatorIcon from '../assets/drag_indicator.svg';
import FileShareIcon from '../assets/file-share.svg';
import FormatTextIcon from '../assets/format-text.svg';
import StackTemplateIcon from '../assets/stack-template.svg';
import Step1Image from '../assets/step_1.png';
import Step2Image from '../assets/step_2.png';
import Step3EnImage from '../assets/step_3_EN.png';
import Step3FrImage from '../assets/step_3_FR.png';
import Step4EnImage from '../assets/step_4_EN.png';
import Step4FrImage from '../assets/step_4_FR.png';
import { OnboardingStepIcon } from '../components/OnboardingStepIcon';
import { OnboardingStepImage } from '../components/OnboardingStepImage';

export const useOnboardingSteps = () => {
  const { i18n, t } = useTranslation();
  const isFrLanguage = i18n.resolvedLanguage === 'fr';

  return useMemo<OnboardingStep[]>(
    () => [
      {
        icon: (
          <OnboardingStepIcon>
            <DragIndicatorIcon aria-hidden="true" />
          </OnboardingStepIcon>
        ),
        title: t('Onboarding step 1 title'),
        description: t('Onboarding step 1 description'),
        content: (
          <OnboardingStepImage
            src={Step1Image.src}
            alt={t('Onboarding step 1 title')}
          />
        ),
      },
      {
        icon: (
          <OnboardingStepIcon>
            <FormatTextIcon aria-hidden="true" />
          </OnboardingStepIcon>
        ),
        title: t('Onboarding step 2 title'),
        description: t('Onboarding step 2 description'),
        content: (
          <OnboardingStepImage
            src={Step2Image.src}
            alt={t('Onboarding step 2 title')}
          />
        ),
      },
      {
        icon: (
          <OnboardingStepIcon>
            <FileShareIcon aria-hidden="true" />
          </OnboardingStepIcon>
        ),
        title: t('Onboarding step 3 title'),
        description: t('Onboarding step 3 description'),
        content: (
          <OnboardingStepImage
            src={isFrLanguage ? Step3FrImage.src : Step3EnImage.src}
            alt={t('Onboarding step 3 title')}
          />
        ),
      },
      {
        icon: (
          <OnboardingStepIcon>
            <StackTemplateIcon aria-hidden="true" />
          </OnboardingStepIcon>
        ),
        title: t('Onboarding step 4 title'),
        description: t('Onboarding step 4 description'),
        content: (
          <OnboardingStepImage
            src={isFrLanguage ? Step4FrImage.src : Step4EnImage.src}
            alt={t('Onboarding step 4 title')}
          />
        ),
      },
    ],
    [isFrLanguage, t],
  );
};
