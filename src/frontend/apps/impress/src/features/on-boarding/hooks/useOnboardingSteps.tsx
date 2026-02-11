import { type OnboardingStep } from '@gouvfr-lasuite/ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';

import DragIndicatorIcon from '../assets/drag_indicator.svg';
import FileShareIcon from '../assets/file-share.svg';
import FormatTextIcon from '../assets/format-text.svg';
import StackTemplateIcon from '../assets/stack-template.svg';
import { OnboardingStepIcon } from '../components/OnboardingStepIcon';
import { OnboardingStepImage } from '../components/OnboardingStepImage';

export interface OnboardingStepsData {
  steps: OnboardingStep[];
  imageSources: string[];
}

export const useOnboardingSteps = () => {
  const { t } = useTranslation();
  const { contextualTokens, colorsTokens } = useCunninghamTheme();
  const activeColor =
    contextualTokens.content.semantic.brand.tertiary ??
    colorsTokens['brand-600'];

  const step1Title = t('Compose your doc easily');
  const step1Description = t(
    'Move, duplicate, and transform your texts, headings, lists, images without breaking your layout.',
  );
  const step2Title = t('Format your content with the toolbar');
  const step2Description = t(
    'Apply styles, structure, and emphasis in one click—keep documents clean, consistent, and easy to scan.',
  );
  const step3Title = t('Share and collaborate with ease');
  const step3Description = t(
    'Decide exactly who can view, comment, edit—or simply use shareable links.',
  );
  const step4Title = t('Draw inspiration from the content library');
  const step4Description = t(
    'Start from ready-made templates for common use cases, then customize them to match your workflow in minutes.',
  );
  const step1ImageSrc = t('assets/onboarding/step_1', {
    desc: 'URL of onboarding step 1 preview image',
    defaultValue: '/assets/on-boarding/step_1_FR.gif',
  });
  const step2ImageSrc = t('assets/onboarding/step_2', {
    desc: 'URL of onboarding step 2 preview image',
    defaultValue: '/assets/on-boarding/step_2_FR.gif',
  });
  const step3ImageSrc = t('assets/onboarding/step_3', {
    desc: 'URL of onboarding step 3 preview image',
    defaultValue: '/assets/on-boarding/step_3_FR.png',
  });
  const step4ImageSrc = t('assets/onboarding/step_4', {
    desc: 'URL of onboarding step 4 preview image',
    defaultValue: '/assets/on-boarding/step_4_FR.png',
  });

  return useMemo<OnboardingStepsData>(
    () => ({
      imageSources: [
        step1ImageSrc,
        step2ImageSrc,
        step3ImageSrc,
        step4ImageSrc,
      ],
      steps: [
        {
          icon: (
            <OnboardingStepIcon>
              <DragIndicatorIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          activeIcon: (
            <OnboardingStepIcon color={activeColor}>
              <DragIndicatorIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          title: step1Title,
          description: step1Description,
          content: <OnboardingStepImage src={step1ImageSrc} alt={step1Title} />,
        },
        {
          icon: (
            <OnboardingStepIcon>
              <FormatTextIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          activeIcon: (
            <OnboardingStepIcon color={activeColor}>
              <FormatTextIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          title: step2Title,
          description: step2Description,
          content: <OnboardingStepImage src={step2ImageSrc} alt={step2Title} />,
        },
        {
          icon: (
            <OnboardingStepIcon>
              <FileShareIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          activeIcon: (
            <OnboardingStepIcon color={activeColor}>
              <FileShareIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          title: step3Title,
          description: step3Description,
          content: <OnboardingStepImage src={step3ImageSrc} alt={step3Title} />,
        },
        {
          icon: (
            <OnboardingStepIcon>
              <StackTemplateIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          activeIcon: (
            <OnboardingStepIcon color={activeColor}>
              <StackTemplateIcon aria-hidden="true" />
            </OnboardingStepIcon>
          ),
          title: step4Title,
          description: step4Description,
          content: <OnboardingStepImage src={step4ImageSrc} alt={step4Title} />,
        },
      ],
    }),
    [
      activeColor,
      step1ImageSrc,
      step1Description,
      step1Title,
      step2ImageSrc,
      step2Description,
      step2Title,
      step3ImageSrc,
      step3Description,
      step3Title,
      step4ImageSrc,
      step4Description,
      step4Title,
    ],
  );
};
