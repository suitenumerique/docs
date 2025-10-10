import clsx from 'clsx';
import { css } from 'styled-components';

import { Text, TextType } from '@/components';

type IconProps = TextType & {
  disabled?: boolean;
  iconName: string;
  variant?: 'filled' | 'outlined' | 'symbols-outlined';
};
export const Icon = ({
  className,
  iconName,
  disabled,
  variant = 'outlined',
  $variation,
  ...textProps
}: IconProps) => {
  const hasLabel = 'aria-label' in textProps || 'aria-labelledby' in textProps;
  const ariaHidden =
    'aria-hidden' in textProps ? textProps['aria-hidden'] : !hasLabel;

  return (
    <Text
      aria-hidden={ariaHidden}
      className={clsx('--docs--icon-bg', className, {
        'material-icons-filled': variant === 'filled',
        'material-icons': variant === 'outlined',
        'material-symbols-outlined': variant === 'symbols-outlined',
      })}
      $variation={disabled ? '300' : $variation}
      aria-disabled={disabled}
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
