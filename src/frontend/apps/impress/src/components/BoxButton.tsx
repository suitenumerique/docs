import { forwardRef } from 'react';
import { css } from 'styled-components';

import { Box, BoxType } from './Box';

export type BoxButtonType = BoxType & {
  disabled?: boolean;
};

/**

/**
 * Styleless button that extends the Box component.
 * Good to wrap around SVGs or other elements that need to be clickable.
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
const BoxButton = forwardRef<HTMLDivElement, BoxButtonType>(
  ({ $css, ...props }, ref) => {
    const theme = props.$theme || 'greyscale';
    const variation = props.$variation || '400';

    return (
      <Box
        ref={ref}
        as="button"
        $background="none"
        $margin="none"
        $padding="none"
        $hasTransition
        $css={css`
          cursor: ${props.disabled ? 'not-allowed' : 'pointer'};
          border: none;
          outline: none;
          font-family: inherit;
          color: ${props.disabled
            ? `var(--c--theme--colors--${theme}-400) !important`
            : `inherit`};

          &:focus-visible {
            transition: none;
            outline: 2px solid var(--c--theme--colors--${theme}-${variation});
            border-radius: 1px;
            outline-offset: 4px;
          }
          ${$css || ''}
        `}
        {...props}
        className={`--docs--box-button ${props.className || ''}`}
        onClick={(event: React.MouseEvent<HTMLDivElement>) => {
          if (props.disabled) {
            return;
          }
          props.onClick?.(event);
        }}
      />
    );
  },
);

BoxButton.displayName = 'BoxButton';
export { BoxButton };
