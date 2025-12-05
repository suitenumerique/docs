import clsx from 'clsx';
import React from 'react';
import { css } from 'styled-components';

import { Text, TextType } from '@/components';

type IconBase = TextType & {
  disabled?: boolean;
};

type IconMaterialProps = IconBase & {
  iconName: string;
  variant?: 'filled' | 'outlined' | 'symbols-outlined';
  icon?: never;
};

type IconSVGProps = IconBase & {
  icon: React.ReactNode;
  iconName?: never;
  variant?: never;
};

export const Icon = ({
  className,
  disabled,
  iconName,
  icon,
  variant = 'outlined',
  $theme = 'neutral',
  ...textProps
}: IconMaterialProps | IconSVGProps) => {
  const hasLabel = 'aria-label' in textProps || 'aria-labelledby' in textProps;
  const ariaHidden =
    'aria-hidden' in textProps ? textProps['aria-hidden'] : !hasLabel;

  return (
    <Text
      aria-hidden={ariaHidden}
      className={clsx('--docs--icon-bg', className, {
        'material-icons-filled': variant === 'filled' && iconName,
        'material-icons': variant === 'outlined' && iconName,
        'material-symbols-outlined': variant === 'symbols-outlined' && iconName,
      })}
      $theme={disabled ? 'disabled' : $theme}
      aria-disabled={disabled}
      {...textProps}
    >
      {iconName ?? icon}
    </Text>
  );
};

type IconOptionsProps = TextType & {
  isHorizontal?: boolean;
};

export const IconOptions = ({
  isHorizontal,
  $css,
  ...props
}: IconOptionsProps) => {
  return (
    <Icon
      iconName={isHorizontal ? 'more_horiz' : 'more_vert'}
      $css={css`
        user-select: none;
        ${$css}
      `}
      {...props}
    />
  );
};
