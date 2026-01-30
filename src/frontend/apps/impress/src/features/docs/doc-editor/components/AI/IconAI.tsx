import { RuleSet, css } from 'styled-components';

import { Icon } from '@/components';

import IconAIBase from '../../assets/IconAI.svg';

interface IconAIProps {
  isHighlighted?: boolean;
  width: string;
  $css?: string | RuleSet<object>;
}

export const IconAI = ({ isHighlighted, width, $css }: IconAIProps) => {
  return (
    <Icon
      className="--docs--icon-bg"
      $css={css`
        border: 1px solid var(--c--globals--colors--gray-100);
        color: var(--c--globals--colors--gray-700);
        transition: all 0.1s ease-in;
        box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.05);
        ${isHighlighted &&
        css`
          background-color: #5858e1;
          border: 1px solid #8484f5;
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
