import { HorizontalSeparator } from '@gouvfr-lasuite/ui-kit';
import {
  Fragment,
  PropsWithChildren,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, BoxProps, DropButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useKeyboardAction } from '@/hooks';

import { useDropdownKeyboardNav } from './hook/useDropdownKeyboardNav';

export type DropdownMenuOption = {
  icon?: ReactNode;
  label: string;
  testId?: string;
  value?: string;
  callback?: () => void | Promise<unknown>;
  danger?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  show?: boolean;
  showSeparator?: boolean;
};

export type DropdownMenuProps = {
  options: DropdownMenuOption[];
  showArrow?: boolean;
  label?: string;
  arrowCss?: BoxProps['$css'];
  buttonCss?: BoxProps['$css'];
  disabled?: boolean;
  opened?: boolean;
  topMessage?: string;
  selectedValues?: string[];
  afterOpenChange?: (isOpen: boolean) => void;
  testId?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
};

export const DropdownMenu = ({
  options,
  children,
  disabled = false,
  showArrow = false,
  arrowCss,
  buttonCss,
  label,
  opened,
  topMessage,
  afterOpenChange,
  selectedValues,
  testId,
  buttonRef,
}: PropsWithChildren<DropdownMenuProps>) => {
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const keyboardAction = useKeyboardAction();
  const [isOpen, setIsOpen] = useState(opened ?? false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const blockButtonRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsOpen(isOpen);
      setFocusedIndex(-1);
      afterOpenChange?.(isOpen);
    },
    [afterOpenChange],
  );

  useDropdownKeyboardNav({
    isOpen,
    focusedIndex,
    options,
    menuItemRefs,
    setFocusedIndex,
    onOpenChange,
  });

  // Focus selected menu item when menu opens
  useEffect(() => {
    if (isOpen && menuItemRefs.current.length > 0) {
      const selectedIndex = options.findIndex((option) => option.isSelected);
      if (selectedIndex !== -1) {
        setFocusedIndex(selectedIndex);
        setTimeout(() => {
          menuItemRefs.current[selectedIndex]?.focus();
        }, 0);
      }
    }
  }, [isOpen, options]);

  const triggerOption = useCallback(
    (option: DropdownMenuOption) => {
      onOpenChange?.(false);
      void option.callback?.();
    },
    [onOpenChange],
  );

  if (disabled) {
    return children;
  }

  return (
    <DropButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={label}
      buttonCss={buttonCss}
      testId={testId}
      buttonRef={buttonRef}
      button={
        showArrow ? (
          <Box
            ref={blockButtonRef}
            $direction="row"
            $align="center"
            $position="relative"
          >
            <Box>{children}</Box>
            <Icon
              $css={
                arrowCss ??
                css`
                  color: var(--c--globals--colors--brand-600);
                `
              }
              iconName={isOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
            />
          </Box>
        ) : (
          <Box ref={blockButtonRef} $color="inherit">
            {children}
          </Box>
        )
      }
    >
      <Box
        $maxWidth="320px"
        $minWidth={`${blockButtonRef.current?.clientWidth}px`}
        role="menu"
        aria-label={label}
      >
        {topMessage && (
          <Text
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
          const isFocused = index === focusedIndex;

          return (
            <Fragment key={option.label}>
              <BoxButton
                ref={(el) => {
                  menuItemRefs.current[index] = el;
                }}
                role="menuitem"
                data-testid={option.testId}
                $direction="row"
                disabled={isDisabled}
                $hasTransition={false}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  triggerOption(option);
                }}
                onKeyDown={keyboardAction(() => triggerOption(option))}
                key={option.label}
                $align="center"
                $justify="space-between"
                $background={colorsTokens['gray-000']}
                $color={colorsTokens['brand-600']}
                $padding={{ vertical: 'xs', horizontal: 'base' }}
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
                    border-bottom-left-radius: var(--c--globals--spacings--st);
                    border-bottom-right-radius: var(--c--globals--spacings--st);
                  `}
                  font-size: var(--c--globals--font--sizes--sm);
                  color: var(--c--globals--colors--gray-1000);
                  font-weight: var(--c--globals--font--weights--medium);
                  cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                  user-select: none;

                  &:hover {
                    background-color: var(
                      --c--contextuals--background--semantic--contextual--primary
                    );
                  }

                  &:focus-visible {
                    outline: 2px solid var(--c--globals--colors--brand-400);
                    outline-offset: -2px;
                    background-color: var(
                      --c--contextuals--background--semantic--contextual--primary
                    );
                  }

                  /**
                  * TODO: This part seems to have a problem with DocToolBox
                  */
                  /* ${isFocused &&
                  css`
                    outline-offset: -2px;
                    background-color: var(
                      --c--contextuals--background--semantic--contextual--primary
                    );
                  `} */
                `}
              >
                <Box
                  $direction="row"
                  $align="center"
                  $gap={spacingsTokens['base']}
                >
                  {option.icon && typeof option.icon === 'string' && (
                    <Icon
                      $size="20px"
                      $theme="gray"
                      $variation={isDisabled ? 'tertiary' : 'primary'}
                      iconName={option.icon}
                      aria-hidden="true"
                    />
                  )}
                  {option.icon &&
                    typeof option.icon !== 'string' &&
                    option.icon}
                  <Text $variation={isDisabled ? 'tertiary' : 'primary'}>
                    {option.label}
                  </Text>
                </Box>
                {(option.isSelected ||
                  selectedValues?.includes(option.value ?? '')) && (
                  <Icon
                    iconName="check"
                    $size="20px"
                    $theme="gray"
                    aria-hidden="true"
                  />
                )}
              </BoxButton>
              {option.showSeparator && (
                <HorizontalSeparator withPadding={false} />
              )}
            </Fragment>
          );
        })}
      </Box>
    </DropButton>
  );
};
