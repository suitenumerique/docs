import { css } from 'styled-components';

import { Text, TextType } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

type IconProps = TextType & {
  iconName: string;
};
export const Icon = ({ iconName, ...textProps }: IconProps) => {
  return (
    <Text $isMaterialIcon {...textProps}>
      {iconName}
    </Text>
  );
};

interface IconBGProps extends TextType {
  iconName: string;
}

export const IconBG = ({ iconName, ...textProps }: IconBGProps) => {
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Text
      $isMaterialIcon
      $size="36px"
      $theme="primary"
      $variation="600"
      $background={colorsTokens()['primary-bg']}
      $css={`
        border: 1px solid ${colorsTokens()['primary-200']}; 
        user-select: none;
      `}
      $radius="12px"
      $padding="4px"
      $margin="auto"
      {...textProps}
    >
      {iconName}
    </Text>
  );
};

type IconOptionsProps = TextType & {
  isHorizontal?: boolean;
};

export const IconOptions = ({ isHorizontal, ...props }: IconOptionsProps) => {
  return (
    <Text
      {...props}
      $isMaterialIcon
      $css={css`
        user-select: none;
        ${props.$css}
      `}
    >
      {isHorizontal ? 'more_horiz' : 'more_vert'}
    </Text>
  );
};
