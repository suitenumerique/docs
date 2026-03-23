import { forwardRef } from 'react';
import { css } from 'styled-components';

import { Box, BoxType } from './Box';

export type BoxButtonType = BoxType & {
  disabled?: boolean;
};

/**
 * Styleless button that extends the Box component.
 * Good to wrap around SVGs or other elements that need to be clickable.
 * Uses aria-disabled instead of native disabled to preserve keyboard focusability.
 * @param props - @see BoxType props
 * @param ref
 * @see Box
 * @example
 * ```tsx
 *  <BoxButton $radius="100%" aria-label="My button" onClick={() => console.log('clicked')}>
 *    Click me
 *  </BoxButton>
 * ```
 */
const BoxButton = forwardRef<HTMLButtonElement, BoxButtonType>(
  ({ $css, disabled, ...props }, ref) => {
    const theme = props.$theme || 'gray';
    const variation = props.$variation || 'primary';

    return (
      <Box
        ref={ref}
        as="button"
        type="button"
        $background="none"
        $margin="none"
        $padding="none"
        $hasTransition
        aria-disabled={disabled || undefined}
        $css={css`
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          border: none;
          outline: none;
          font-family: inherit;
          color: ${disabled &&
          `var(--c--contextuals--content--semantic--disabled--primary)`};
          &:focus-visible {
            transition: none;
            outline: 2px solid
              var(--c--contextuals--content--semantic--${theme}--${variation});
            border-radius: 1px;
            outline-offset: var(--c--globals--spacings--st);
          }
          ${$css || ''}
        `}
        {...props}
        className={`--docs--box-button ${props.className || ''}`}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          if (disabled) {
            return;
          }
          props.onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
        }}
      />
    );
  },
);

BoxButton.displayName = 'BoxButton';
export { BoxButton };
