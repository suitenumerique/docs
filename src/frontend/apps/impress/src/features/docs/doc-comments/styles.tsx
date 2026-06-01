import { createGlobalStyle, css } from 'styled-components';

export const DocsCommentsStyle = createGlobalStyle<{
  canSeeComment: boolean;
  currentUserAvatarUrl?: string;
}>`
  .--docs--main-editor.bn-root,
  .--docs--main-editor.bn-root .ProseMirror,
  .--docs--comments-sidebar.bn-root,
  .--docs--comments-sidebar.bn-root .ProseMirror {
    // Comments marks in the editor
    .bn-editor {
      // Resets blocknote comments styles
      .bn-thread-mark,
      .bn-thread-mark-selected {
        background-color: transparent;
      }

      ${({ canSeeComment }) =>
        canSeeComment &&
        css`
          .bn-thread-mark:not([data-orphan='true']) {
            background-color: color-mix(
              in srgb,
              var(--c--contextuals--background--palette--yellow--tertiary) 40%,
              transparent
            );
            border-bottom: 2px solid
              var(--c--contextuals--background--palette--yellow--secondary);

            mix-blend-mode: multiply;

            transition:
              background-color var(--c--globals--transitions--duration),
              border-bottom-color var(--c--globals--transitions--duration);

            &:has(.bn-thread-mark-selected) {
              background-color: var(
                --c--contextuals--background--palette--yellow--tertiary
              );
            }
          }

          .bn-thread-mark[data-orphan='true']:has(> .bn-thread-mark-selected) {
            background-color: color-mix(
              in srgb,
              var(--c--contextuals--background--palette--blue-1--tertiary) 40%,
              transparent
            );
            border-bottom: 2px solid
              var(--c--contextuals--background--palette--blue-1--secondary);

            mix-blend-mode: multiply;

            transition:
              background-color var(--c--globals--transitions--duration),
              border-bottom-color var(--c--globals--transitions--duration);
          }
        `}

      [data-show-selection] {
        color: HighlightText;
      }
    }

    em-emoji-picker {
      box-shadow: 0px 6px 18px 0px #00001229;
      min-height: 420px;
    }

    // Thread modal
    .bn-thread {
      width: 100%;
      min-width: calc(min(400px, 90vw));
      max-width: calc(min(400px, 90vw));
      max-height: calc(min(500px, 60vh));
      padding: var(--c--globals--spacings--xxs) var(--c--globals--spacings--xxxs);
      box-shadow: 0px 6px 18px 0px #00001229;
      margin-left: 20px;
      margin-right: 20px;
      gap: 0;
      overflow: auto;

      .bn-default-styles {
        font-family: var(--c--globals--font--families--base);
      }

      .bn-block {
        font-size: 14px;
      }

      .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child):before {
        font-style: normal;
        font-size: 14px;
      }

      // Remove tooltip
      *[role='tooltip'] {
        display: none;
      }

      & .bn-thread-comments {
        gap: var(--c--globals--spacings--xxxs);
      }

      .bn-thread-comment {
        padding: 8px;
        flex-wrap: nowrap;
        gap: 0px;
        flex-direction: column;
        align-items: initial;

        & > div:first-child {
          flex-direction: row;
        }

        & .bn-editor {
          padding-left: var(--c--globals--spacings--lg);
          .bn-inline-content {
            color: var(--c--globals--colors--gray-700);
          }
        }

        // Emoji
        & .bn-badge-group {
          padding-left: var(--c--globals--spacings--lg);
          .bn-badge label {
            padding: var(--c--globals--spacings--0)
              var(--c--globals--spacings--st);
            background: none;
            border: 1px solid var(--c--contextuals--border--semantic--neutral--tertiary);
            border-radius: var(--c--globals--spacings--st);
            height: var(--c--globals--spacings--md);
          }
        }

        // Top bar (Name / Date / Actions) when actions displayed
        &:has(.bn-comment-actions) {
          & > .mantine-Group-root:first-child {
            right: 0.3rem !important;
            top: 0.3rem !important;
            background: linear-gradient(
              to left,
              #fff 90%,
              rgba(255, 255, 255, 0) 100%
            );
          }

          .bn-menu-dropdown {
            box-shadow: 0px 0px 6px 0px #0000911a;
          }
        }

        // Top bar (Name / Date / Actions)
        & > .mantine-Group-root {
          flex-wrap: nowrap;
          max-width: 100%;
          gap: 0.5rem;

          // Date
          span.mantine-focus-auto {
            font-weight: 400;
            margin-left: var(--c--globals--spacings--2xs) !important;
          }

          .bn-comment-actions {
            background: transparent;
            border: none;

            .mantine-Button-root {
              background-color: transparent;
              height: var(--c--globals--spacings--md);
              width: var(--c--globals--spacings--md);
              padding: var(--c--globals--spacings--0);

              &:hover {
                background-color: var(--c--globals--colors--gray-100);
              }
            }

            button[role='menuitem'] svg {
              color: var(--c--globals--colors--gray-600);
            }
          }

          & svg {
            color: var(--c--contextuals--background--semantic--brand--primary);
          }
        }

        // Actions button edit comment
        .bn-root + .bn-comment-actions-wrapper {
          margin-top: var(--c--globals--spacings--2xs);
          .bn-comment-actions {
            flex-direction: row-reverse;
            background: none;
            border: none;
            gap: 0.4rem !important;

            & > button {
              height: var(--c--globals--spacings--md);
              padding-inline: var(--c--globals--spacings--st);
              border: 1px solid
                var(--c--contextuals--background--semantic--brand--primary);
              background: var(
                --c--contextuals--background--semantic--brand--primary
              );
              color: var(
                --c--contextuals--content--semantic--brand--on-brand
              );

              &:hover {
                background-color: var(--c--contextuals--background--semantic--brand--primary);
              }

              &:last-child {
                background: white;
                border: 1px solid
                  var(--c--contextuals--border--surface--primary);
                color: var(
                  --c--contextuals--background--semantic--brand--primary
                );
              }
            }
          }
        }
      }

      // Input to add a new comment
      .bn-thread-composer,
      &:has(> .bn-comment-editor + .bn-comment-actions-wrapper) {
        padding: 0.5rem 8px;
        flex-direction: row;
        gap: 10px;

        .bn-container.bn-comment-editor {
          min-width: 0;
        }

        &::before {
          content: '';
          width: 26px;
          height: 26px;
          flex: 0 0 26px;
          background-image: ${({ currentUserAvatarUrl }) =>
            currentUserAvatarUrl ? `url("${currentUserAvatarUrl}")` : 'none'};
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
        }

        & .bn-block-content:has(.ProseMirror-trailingBreak:only-child):after {
          color: var(--c--contextuals--content--semantic--neutral--tertiary);
          font-style: normal;
        }
      }

      // Actions button send comment
      .bn-thread-composer .bn-comment-actions-wrapper,
      &:not(.selected) .bn-comment-actions-wrapper {
        flex-basis: fit-content;

        .bn-action-toolbar.bn-comment-actions {
          border: none;
          background-color: transparent;

          button {
            font-size: 0;
            background: var(
              --c--contextuals--background--semantic--brand--primary
            );
            width: var(--c--globals--spacings--md);
            height: var(--c--globals--spacings--md);
            padding: var(--c--globals--spacings--0);

            &:disabled {
              background: var(--c--globals--colors--gray-300);
            }

            & .mantine-Button-label::before {
              content: 'arrow_upward_alt';
              font-family: 'Material Symbols Outlined Variable', sans-serif;
              font-size: 18px;
              color: var(--c--contextuals--content--semantic--brand--on-brand);
            }
          }
        }
      }

      // Input first comment
      &:not(.selected) {
        gap: 0.5rem;

        .bn-container.bn-comment-editor {
          min-width: 0;

          .ProseMirror.bn-editor {
            cursor: text;
          }
        }
      }
    }
  }

  /**
  * Styles for the comments sidebar
  */
  .--docs--comments-sidebar.bn-root{
    flex: 1;
    min-height: 0;
    overflow: auto;

    .bn-editor[contenteditable="false"]{
      &:focus-visible {
        outline: 2px solid var(--c--globals--colors--brand-400);
        outline-offset: -2px;
      }
    }

    .bn-threads-sidebar {
      gap: 0;
      border-radius: 0;
      min-height: 100%;

      .bn-thread-expand-prompt p {
        font-size: var(--c--globals--font--sizes--xs);
      }

      .bn-thread {
        margin: 0;
        max-width: 100%;
        width: 100%;
        min-width: 0;
        overflow: visible;
        padding: var(--c--globals--spacings--xxs) var(--c--globals--spacings--xxxs);
        border: none;
        border-radius: 0;
        border-bottom: 1px solid var(--c--contextuals--border--surface--primary);

        &.selected {
          border: none;
          background: var(--c--contextuals--background--semantic--neutral--tertiary);
          max-height: none;
        }

        &:hover {
          background: var(--c--contextuals--background--semantic--neutral--tertiary);
        }

        & .bn-header-text {
          display: none;
        }

        &.bn-thread-orphaned {
          & .bn-header-text {
            display: block;
            padding-inline: var(--c--globals--spacings--xs);
          }
        }

        .bn-thread-comment {
          padding: var(--c--globals--spacings--xs);

          &:has(.bn-comment-actions) {
            & > .mantine-Group-root:first-child {
              background: linear-gradient(
                to left,
                var(--c--contextuals--background--semantic--neutral--tertiary) 90%,
                rgba(255, 255, 255, 0) 100%
              );
            }

            .bn-menu-dropdown {
              box-shadow: 0px 0px 6px 0px #0000911a;
            }
          }
        }
      }
    }
  }
`;
