import clsx from 'clsx';
import { css } from 'styled-components';

import { Text, TextType } from '@/components';
export enum IconVariant {
  Filled = 'filled',
  Outlined = 'outlined',
}

type IconProps = TextType & {
  iconName: string;
  variant?: IconVariant;
};
export const Icon = ({
  iconName,
  variant = IconVariant.Outlined,
  ...textProps
}: IconProps) => {
  return (
    <Text
      {...textProps}
      className={clsx('--docs--icon-bg', textProps.className, {
        'material-icons-filled': variant === IconVariant.Filled,
        'material-icons': variant === IconVariant.Outlined,
      })}
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
    <Icon
      {...props}
      iconName={isHorizontal ? 'more_horiz' : 'more_vert'}
      $css={css`
        user-select: none;
        ${props.$css}
      `}
    />
  );
};
