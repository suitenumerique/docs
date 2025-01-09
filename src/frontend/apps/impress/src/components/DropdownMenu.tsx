import { PropsWithChildren, useState } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, BoxProps, DropButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export type DropdownMenuOption = {
  icon?: string;
  label: string;
  testId?: string;
  callback?: () => void | Promise<unknown>;
  danger?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  show?: boolean;
};

export type DropdownMenuProps = {
  options: DropdownMenuOption[];
  showArrow?: boolean;
  label?: string;
  arrowCss?: BoxProps['$css'];
  topMessage?: string;
};

export const DropdownMenu = ({
  options,
  children,
  showArrow = false,
  arrowCss,
  label,
  topMessage,
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
      label={label}
      button={
        showArrow ? (
          <Box $direction="row" $align="center">
            <div>{children}</div>
            <Icon
              $variation="600"
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
      <Box $maxWidth="320px">
        {topMessage && (
          <Text
            $variation="700"
            $wrap="wrap"
            $size="xs"
            $weight="bold"
            $padding={{ vertical: 'xs', horizontal: 'base' }}
          >
            {topMessage}
          </Text>
        )}
        {options.map((option, index) => {
          if (option.show !== undefined && !option.show) {
            return;
          }
          const isDisabled = option.disabled !== undefined && option.disabled;
          return (
            <BoxButton
              aria-label={option.label}
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
              $justify="space-between"
              $background={colors['greyscale-000']}
              $color={colors['primary-600']}
              $padding={{ vertical: 'xs', horizontal: 'base' }}
              $width="100%"
              $gap={spacings['base']}
              $css={css`
                border: none;
                ${index === 0 &&
                css`
                  border-top-left-radius: 4px;
                  border-top-right-radius: 4px;
                `}
                ${index === options.length - 1 &&
                css`
                  border-bottom-left-radius: 4px;
                  border-bottom-right-radius: 4px;
                `}
                font-size: var(--c--theme--font--sizes--sm);
                color: var(--c--theme--colors--greyscale-1000);
                font-weight: 500;
                cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                user-select: none;

                &:hover {
                  background-color: var(--c--theme--colors--greyscale-050);
                }
              `}
            >
              <Box $direction="row" $align="center" $gap={spacings['base']}>
                {option.icon && (
                  <Icon
                    $size="20px"
                    $theme="greyscale"
                    $variation={isDisabled ? '400' : '1000'}
                    iconName={option.icon}
                  />
                )}
                <Text $variation={isDisabled ? '400' : '1000'}>
                  {option.label}
                </Text>
              </Box>
              {option.isSelected && (
                <Icon iconName="check" $size="20px" $theme="greyscale" />
              )}
            </BoxButton>
          );
        })}
      </Box>
    </DropButton>
  );
};
