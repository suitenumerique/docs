import clsx from 'clsx';
import { css } from 'styled-components';

import { Text, TextType } from '@/components';

type IconProps = TextType & {
  iconName: string;
  variant?: 'filled' | 'outlined';
};
export const Icon = ({
  iconName,
  variant = 'outlined',
  ...textProps
}: IconProps) => {
  return (
    <Text
      {...textProps}
      className={clsx('--docs--icon-bg', textProps.className, {
        'material-icons-filled': variant === 'filled',
        'material-icons': variant === 'outlined',
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
