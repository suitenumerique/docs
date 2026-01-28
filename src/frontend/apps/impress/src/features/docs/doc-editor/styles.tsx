import { css } from 'styled-components';

export const cssEditor = css`
  .mantine-Menu-itemLabel,
  .mantine-Button-label {
    font-family: var(--c--components--button--font-family);
  }

  &,
  & > .bn-container,
  & .ProseMirror {
    height: 100%;
  }

  /**
  * Token Mantime
  */
  & > .bn-container {
    --bn-colors-editor-text: var(
      --c--contextuals--content--semantic--neutral--primary
    );
    --bn-colors-side-menu: var(
      --c--contextuals--content--semantic--neutral--tertiary
    );
  }

  /**
  * Ensure long placeholder text is truncated with ellipsis
  */
  .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
    .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    width: inherit;
    height: inherit;
  }
  .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
    .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child) {
    position: relative;
  }

  /**
  * Ensure images with unsafe URLs are not interactive
  */
  img.bn-visual-media[src*='-unsafe'] {
    pointer-events: none;
  }

  /**
  * Collaboration cursor styles
  */
  .collaboration-cursor-custom__base {
    position: relative;
  }
  .collaboration-cursor-custom__caret {
    position: absolute;
    height: 100%;
    width: 2px;
    bottom: 4%;
    left: -1px;
  }
  .collaboration-cursor-custom__label {
    color: #0d0d0d;
    font-size: 12px;
    font-weight: 600;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    position: absolute;
    top: -17px;
    left: 0px;
    padding: 0px 6px;
    border-radius: 0px;
    white-space: nowrap;
    transition: clip-path 0.3s ease-in-out;
    border-radius: 4px 4px 4px 0;
    box-shadow: inset -2px 2px 6px #ffffff00;
    clip-path: polygon(0 85%, 4% 85%, 4% 100%, 0% 100%);
  }
  .collaboration-cursor-custom__base[data-active]
    .collaboration-cursor-custom__label {
    pointer-events: none;
    box-shadow: inset -2px 2px 6px #ffffff88;
    clip-path: polygon(0 0, 100% 0%, 100% 100%, 0% 100%);
  }

  /**
  * Side menu
  */
  .bn-side-menu[data-block-type='heading'][data-level='1'] {
    height: 54px;
  }
  .bn-side-menu[data-block-type='heading'][data-level='2'] {
    height: 43px;
  }
  .bn-side-menu[data-block-type='heading'][data-level='3'] {
    height: 35px;
  }
  .bn-side-menu[data-block-type='divider'] {
    height: 38px;
  }
  .bn-side-menu .mantine-UnstyledButton-root svg {
    color: var(
      --c--contextuals--content--semantic--neutral--tertiary
    ) !important;
  }

  /**
  * Callout, Paragraph and Heading blocks
  */
  .bn-block {
    border-radius: var(--c--globals--spacings--3xs);
  }
  .bn-block-outer {
    border-radius: var(--c--globals--spacings--3xs);
  }
  .bn-block > .bn-block-content[data-background-color] {
    padding: var(--c--globals--spacings--3xs) var(--c--globals--spacings--3xs);
    border-radius: var(--c--globals--spacings--3xs);
  }
  .bn-block-content[data-content-type='checkListItem'][data-checked='true']
    .bn-inline-content {
    text-decoration: none;
  }
  h1 {
    font-size: 1.875rem;
  }
  h2 {
    font-size: 1.5rem;
  }
  h3 {
    font-size: 1.25rem;
  }
  a {
    color: var(--c--globals--colors--gray-600);
    cursor: pointer;
  }
  .bn-block-group
    .bn-block-group
    .bn-block-outer:not([data-prev-depth-changed]):before {
    border-left: none;
  }

  .bn-toolbar {
    max-width: 95vw;
  }

  /**
  * Quotes
  */
  blockquote {
    border-left: 4px solid var(--c--globals--colors--gray-300);
    font-style: italic;
  }

  /**
    * AI
    */
  ins,
  [data-type='modification'] {
    background: var(--c--globals--colors--brand-100);
    border-bottom: 2px solid var(--c--globals--colors--brand-300);
    color: var(--c--globals--colors--brand-700);
  }

  /**
  * Divider
  */
  [data-content-type='divider'] hr {
    background: #d3d2cf;
    margin: 1rem 0;
    width: 100%;
    border: 1px solid #d3d2cf;
  }

  /**
  * Checklist items
  */
  .bn-block-content[data-content-type='checkListItem'] > div > input {
    appearance: none;
    width: 20px;
    height: 20px;
    border: 2px solid
      var(--c--contextuals--content--semantic--neutral--tertiary);
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    align-self: center;
    margin-top: 2px;
  }
  .bn-block-content[data-content-type='checkListItem'] > div > input:checked {
    background-color: var(--c--contextuals--content--semantic--brand--tertiary);
    border-color: var(--c--contextuals--content--semantic--brand--tertiary);
  }
  .bn-block-content[data-content-type='checkListItem']
    > div
    > input:checked::after {
    content: 'check';
    font-family: 'Material Symbols Outlined Variable', sans-serif;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--c--contextuals--content--semantic--overlay--primary);
    font-size: 18px;
  }

  /**
    * Ensure consistent spacing between headings and paragraphs
   */
  & .bn-block-outer:not(:first-child) {
    &:has(h1) {
      margin-top: 32px;
    }
    &:has(h2) {
      margin-top: 24px;
    }
    &:has(h3) {
      margin-top: 16px;
    }
  }

  & .bn-inline-content code {
    background-color: gainsboro;
    padding: 2px;
    border-radius: 4px;
  }

  @media screen and (width <= 768px) {
    & .bn-editor {
      padding-right: 36px;
    }
  }

  @media screen and (width <= 560px) {
    .--docs--doc-readonly & .bn-editor {
      padding-left: 10px;
    }
    & .bn-editor {
      padding-right: 10px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='1'] {
      height: 46px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='2'] {
      height: 40px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='3'] {
      height: 40px;
    }
    & .bn-editor h1 {
      font-size: 1.6rem;
    }
    & .bn-editor h2 {
      font-size: 1.35rem;
    }
    & .bn-editor h3 {
      font-size: 1.2rem;
    }
    .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
      .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
      font-size: 14px;
    }
  }
`;
