import { PropsWithChildren, useRef, useState } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, BoxProps, DropButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export type DropdownMenuOption = {
  icon?: string;
  label: string;
  testId?: string;
  value?: string;
  callback?: () => void | Promise<unknown>;
  danger?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  padding?: BoxProps['$padding'];
  show?: boolean;
};

export type DropdownMenuProps = {
  options: DropdownMenuOption[];
  showArrow?: boolean;
  label?: string;
  arrowCss?: BoxProps['$css'];
  buttonCss?: BoxProps['$css'];
  disabled?: boolean;
  topMessage?: string;
  selectedValues?: string[];
  afterOpenChange?: (isOpen: boolean) => void;
};

export const DropdownMenu = ({
  options,
  children,
  disabled = false,
  showArrow = false,
  arrowCss,
  buttonCss,
  label,
  topMessage,
  afterOpenChange,
  selectedValues,
}: PropsWithChildren<DropdownMenuProps>) => {
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const [isOpen, setIsOpen] = useState(false);
  const blockButtonRef = useRef<HTMLDivElement>(null);

  const onOpenChange = (isOpen: boolean) => {
    setIsOpen(isOpen);
    afterOpenChange?.(isOpen);
  };

  if (disabled) {
    return children;
  }

  return (
    <DropButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={label}
      buttonCss={buttonCss}
      button={
        showArrow ? (
          <Box
            ref={blockButtonRef}
            $direction="row"
            $align="center"
            $position="relative"
            aria-controls="menu"
          >
            <Box>{children}</Box>
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
          <Box ref={blockButtonRef} aria-controls="menu">
            {children}
          </Box>
        )
      }
    >
      <Box
        $maxWidth="320px"
        $minWidth={`${blockButtonRef.current?.clientWidth}px`}
        role="menu"
      >
        {topMessage && (
          <Text
            $variation="700"
            $wrap="wrap"
            $size="xs"
            $weight="bold"
            $padding={{ vertical: 'xs', horizontal: 'base' }}
            $css={css`
              white-space: pre-line;
            `}
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
              role="menuitem"
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
              $background={colorsTokens['greyscale-000']}
              $color={colorsTokens['primary-600']}
              $padding={
                option.padding ?? { vertical: 'xs', horizontal: 'base' }
              }
              $width="100%"
              $gap={spacingsTokens['base']}
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
              <Box
                $direction="row"
                $align="center"
                $gap={spacingsTokens['base']}
              >
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
              {(option.isSelected ||
                selectedValues?.includes(option.value ?? '')) && (
                <Icon iconName="check" $size="20px" $theme="greyscale" />
              )}
            </BoxButton>
          );
        })}
      </Box>
    </DropButton>
  );
};
