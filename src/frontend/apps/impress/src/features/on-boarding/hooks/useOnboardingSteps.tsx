import { type OnboardingStep } from '@gouvfr-lasuite/ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';

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
  const { contextualTokens, colorsTokens } = useCunninghamTheme();
  const isFrLanguage = i18n.resolvedLanguage === 'fr';
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

  return useMemo<OnboardingStep[]>(
    () => [
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
        content: <OnboardingStepImage src={Step1Image.src} alt={step1Title} />,
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
        content: <OnboardingStepImage src={Step2Image.src} alt={step2Title} />,
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
        content: (
          <OnboardingStepImage
            src={isFrLanguage ? Step3FrImage.src : Step3EnImage.src}
            alt={step3Title}
          />
        ),
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
        content: (
          <OnboardingStepImage
            src={isFrLanguage ? Step4FrImage.src : Step4EnImage.src}
            alt={step4Title}
          />
        ),
      },
    ],
    [
      activeColor,
      isFrLanguage,
      step1Description,
      step1Title,
      step2Description,
      step2Title,
      step3Description,
      step3Title,
      step4Description,
      step4Title,
    ],
  );
};
