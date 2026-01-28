import { RuleSet, css } from 'styled-components';

import { Icon } from '@/components';

import IconAIBase from '../../assets/IconAI.svg';
import IconAILoading from '../../assets/ai-loader.svg';

interface IconAIProps {
  isError?: boolean;
  isHighlighted?: boolean;
  isLoading?: boolean;
  width: string;
  $css?: string | RuleSet<object>;
}

export const IconAI = ({
  isError,
  isHighlighted,
  isLoading,
  width,
  $css,
}: IconAIProps) => {
  if (isError) {
    return (
      <Icon
        $theme="error"
        $variation="secondary"
        icon={<Icon iconName="error" $withThemeInherited $size={width} />}
      />
    );
  }

  if (isLoading) {
    return (
      <Icon
        $theme="brand"
        $variation="tertiary"
        $css={css`
          animation: spin 5s linear infinite;
          @keyframes spin {
            0% {
              transform: rotate(360deg);
            }
            100% {
              transform: rotate(0deg);
            }
          }
          ${$css}
        `}
        $padding="0.15rem"
        $width={width}
        icon={<IconAILoading />}
      />
    );
  }

  return (
    <Icon
      $css={css`
        border: 1px solid var(--c--globals--colors--gray-100);
        color: var(--c--globals--colors--gray-700);
        transition: all 0.1s ease-in;
        box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.05);
        ${isHighlighted &&
        css`
          background-color: var(--c--globals--colors--brand-450);
          border: 1px solid var(--c--globals--colors--brand-350);
          color: #ffffff;
          box-shadow: 0 1px 4px 0 rgba(88, 88, 225, 0.25);
        `}
        ${$css}
      `}
      $radius="100%"
      $padding="0.15rem"
      $width={width}
      icon={<IconAIBase />}
    />
  );
};
