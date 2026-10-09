import { createGlobalStyle } from 'styled-components';

export const DocsFindReplaceStyle = createGlobalStyle`
  .bn-root {
    .find-and-replace-result {
      border-radius: var(--c--globals--spacings--xxxs);
      background: color-mix(
        in srgb,
        var(--c--contextuals--background--palette--yellow--tertiary) 35%,
        transparent
      );
      mix-blend-mode: darken;
    }
    .find-and-replace-result-current {
      background: var(--c--contextuals--background--palette--yellow--tertiary);
    }

    [data-content-type='codeBlock'] {
      .find-and-replace-result {
        background: var(--c--contextuals--background--palette--yellow--tertiary);
        color: var(--c--globals--colors--black-900);
        mix-blend-mode: normal;
      }
      .find-and-replace-result-current {
        background: var(--c--contextuals--background--palette--yellow--primary);
        color: var(--c--globals--colors--black-900);
      }
    }
  }
`;
