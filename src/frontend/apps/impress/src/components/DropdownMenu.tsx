import { PropsWithChildren, useState } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, BoxProps, DropButton, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export type DropdownMenuOption = {
  icon?: string;
  label: string;
  testId?: string;
  callback?: () => void | Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
  show?: boolean;
};

export type DropdownMenuProps = {
  options: DropdownMenuOption[];
  showArrow?: boolean;
  arrowCss?: BoxProps['$css'];
};

export const DropdownMenu = ({
  options,
  children,
  showArrow = false,
  arrowCss,
}: PropsWithChildren<DropdownMenuProps>) => {
  const theme = useCunninghamTheme();
  const spacings = theme.spacingsTokens();
  const colors = theme.colorsTokens();
  const [isOpen, setIsOpen] = useState(false);

  const onOpenChange = (isOpen: boolean) => {
    setIsOpen(isOpen);
  };

  return (
    <DropButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      button={
        showArrow ? (
          <Box>
            <div>{children}</div>
            <Icon
              $css={
                arrowCss ??
                css`
                  color: var(--c--theme--colors--primary-600);
                `
              }
              iconName={isOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
            />
          </Box>
        ) : (
          children
        )
      }
    >
      <Box>
        {options.map((option, index) => {
          if (option.show !== undefined && !option.show) {
            return;
          }

          const isDisabled = option.disabled !== undefined && option.disabled;
          return (
            <BoxButton
              data-testid={option.testId}
              $direction="row"
              disabled={isDisabled}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenChange?.(false);
                void option.callback?.();
              }}
              key={option.label}
              $align="center"
              $background={colors['greyscale-000']}
              $color={colors['primary-600']}
              $padding={{ vertical: 'xs', horizontal: 'base' }}
              $width="100%"
              $gap={spacings['base']}
              $css={css`
                border: none;
                font-size: var(--c--theme--font--sizes--sm);
                color: var(--c--theme--colors--primary-600);
                font-weight: 500;
                cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                user-select: none;
                border-bottom: ${index !== options.length - 1
                  ? `1px solid var(--c--theme--colors--greyscale-200)`
                  : 'none'};

                &:hover {
                  background-color: var(--c--theme--colors--greyscale-050);
                }
              `}
            >
              {option.icon && (
                <Icon
                  $size="20px"
                  $theme={!isDisabled ? 'primary' : 'greyscale'}
                  $variation={!isDisabled ? '600' : '400'}
                  iconName={option.icon}
                />
              )}
              {option.label}
            </BoxButton>
          );
        })}
      </Box>
    </DropButton>
  );
};
