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
}

export const useOnboardingSteps = () => {
  const { t } = useTranslation();
  const { contextualTokens, colorsTokens } = useCunninghamTheme();
  const activeColor =
    contextualTokens.content.semantic.brand.tertiary ??
    colorsTokens['brand-600'];

  return useMemo<OnboardingStepsData>(
    () => ({
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
          title: t('Compose your doc easily'),
          description: t(
            'Move, duplicate, and transform your texts, headings, lists, images without breaking your layout.',
          ),
          content: (
            <OnboardingStepImage
              src={t('src_img_onboarding_step_1', {
                desc: 'URL of onboarding step 1 preview image',
                defaultValue: '/assets/on-boarding/step_1_EN.gif',
              })}
              alt={t('Compose your doc easily')}
            />
          ),
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
          title: t('Format your content with the toolbar'),
          description: t(
            'Apply styles, structure, and emphasis in one click—keep documents clean, consistent, and easy to scan.',
          ),
          content: (
            <OnboardingStepImage
              src={t('src_img_onboarding_step_2', {
                desc: 'URL of onboarding step 2 preview image',
                defaultValue: '/assets/on-boarding/step_2_EN.gif',
              })}
              alt={t('Format your content with the toolbar')}
            />
          ),
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
          title: t('Share and collaborate with ease'),
          description: t(
            'Decide exactly who can view, comment, edit—or simply use shareable links.',
          ),
          content: (
            <OnboardingStepImage
              src={t('src_img_onboarding_step_3', {
                desc: 'URL of onboarding step 3 preview image',
                defaultValue: '/assets/on-boarding/step_3_EN.png',
              })}
              alt={t('Share and collaborate with ease')}
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
          title: t('Draw inspiration from the content library'),
          description: t(
            'Start from ready-made templates for common use cases, then customize them to match your workflow in minutes.',
          ),
          content: (
            <OnboardingStepImage
              src={t('src_img_onboarding_step_4', {
                desc: 'URL of onboarding step 4 preview image',
                defaultValue: '/assets/on-boarding/step_4_EN.png',
              })}
              alt={t('Draw inspiration from the content library')}
            />
          ),
        },
      ],
    }),
    [activeColor, t],
  );
};
