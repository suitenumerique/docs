import { createGlobalStyle } from 'styled-components';

export const QuickSearchStyle = createGlobalStyle`
  & *:focus-visible {
    outline: none;
  }

  .quick-search-container {
    [cmdk-root] {
      width: 100%;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 100ms ease;
      outline: none;
    }

    [cmdk-input] {
      border: none;
      width: 100%;
      font-size: 17px;
      padding: var(--c--globals--spacings--xs);
      background: white;
      outline: none;
      color: var(--c--contextuals--content--semantic--neutral--primary);
      border-radius: var(--c--globals--spacings--0);

      &::placeholder {
        color: var(--c--globals--colors--gray-500);
      }
    }

    [cmdk-item] {
      content-visibility: auto;
      cursor: pointer;
      border-radius: var(--c--globals--spacings--xs);
      font-size: var(--c--globals--font--sizes--sm);
      display: flex;
      align-items: center;
      gap:  var(--c--globals--spacings--xs);
      user-select: none;
      will-change: background, color;
      transition: all 150ms ease;
      transition-property: none;

      .show-right-on-focus {
        opacity: 0;
      }

      &:hover,
      &[data-selected='true'] {
        background: var(--c--contextuals--background--semantic--contextual--primary);
        .show-right-on-focus {
          opacity: 1;
        }
      }

      &[data-disabled='true'] {
        color: var(--c--globals--colors--gray-500);
        cursor: not-allowed;
      }

      & + [cmdk-item] {
        margin-top: var(--c--globals--spacings--st);
      }
    }

    [cmdk-list] {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    [cmdk-vercel-shortcuts] {
      display: flex;
      margin-left: auto;
      gap: 8px;

      kbd {
        font-size: 12px;
        min-width: 20px;
        padding: var(--c--globals--spacings--st);
        height: 20px;
        border-radius: var(--c--globals--spacings--st);
        color: white;
        background: var(--c--globals--colors--gray-500);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-transform: uppercase;
      }
    }

    [cmdk-separator] {
      height: 1px;
      width: 100%;
      background: var(--c--globals--colors--gray-500);
      margin: var(--c--globals--spacings--st) 0;
    }

    *:not([hidden]) + [cmdk-group] {
      margin-top: var(--c--globals--spacings--xs);
    }

    [cmdk-group-heading] {
      user-select: none;
      font-size: var(--c--globals--font--sizes--sm);
      color: var(--c--globals--colors--gray-700);
      font-weight: bold;

      display: flex;
      align-items: center;
      margin-bottom: var(--c--globals--spacings--xs);
    }

    [cmdk-empty] {
    }
  }

  .c__modal__scroller:has(.quick-search-container),
  .c__modal__scroller:has(.noPadding) {
    padding: 0 !important;

    .c__modal__close .c__button {
      right: 5px;
      top: 5px;
      padding: 1.5rem 1rem;
    }

    .c__modal__title {
      font-size: var(--c--globals--font--sizes--xs);
      padding: var(--c--globals--spacings--base);
      margin-bottom: var(--c--globals--spacings--0);
    }
  }
`;
