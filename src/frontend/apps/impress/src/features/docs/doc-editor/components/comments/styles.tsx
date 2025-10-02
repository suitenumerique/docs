import { css } from 'styled-components';

export const cssComments = (
  canSeeComment: boolean,
  currentUserAvatarUrl?: string,
) => css`
  & .--docs--main-editor,
  & .--docs--main-editor .ProseMirror {
    // Comments marks in the editor
    .bn-editor {
      .bn-thread-mark:not([data-orphan='true']),
      .bn-thread-mark-selected:not([data-orphan='true']) {
        background: ${canSeeComment ? '#EDB40066' : 'transparent'};
        color: var(--c--theme--colors--greyscale-700);
      }
    }

    // Thread modal
    .bn-thread {
      width: 400px;
      padding: 8px;
      box-shadow: 0px 6px 18px 0px #00001229;
      margin-left: 20px;
      gap: 0;

      .bn-default-styles {
        font-family: var(--c--theme--font--families--base);
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

      .bn-thread-comments {
        overflow: auto;
        max-height: 500px;

        // to allow popovers to escape the thread container
        &:has(em-emoji-picker) {
          max-height: none;
          overflow: visible;
        }

        em-emoji-picker {
          box-shadow: 0px 6px 18px 0px #00001229;
        }
      }

      .bn-thread-comment {
        padding: 8px;

        & .bn-editor {
          padding-left: 32px;
          .bn-inline-content {
            color: var(--c--theme--colors--greyscale-700);
          }
        }

        // Emoji
        & .bn-badge-group {
          padding-left: 32px;
          .bn-badge label {
            padding: 0 4px;
            background: none;
            border: 1px solid var(--c--theme--colors--greyscale-300);
            border-radius: 4px;
            height: 24px;
          }
        }

        // Top bar (Name / Date / Actions) when actions displayed
        &:has(.bn-comment-actions) {
          & > .mantine-Group-root {
            max-width: 70%;
            right: 0.3rem !important;
            top: 0.3rem !important;
          }
        }

        // Top bar (Name / Date / Actions)
        & > .mantine-Group-root {
          flex-wrap: nowrap;
          max-width: 100%;
          gap: 0.5rem;

          // Date
          span.mantine-focus-auto {
            display: inline-block;
          }

          .bn-comment-actions {
            background: transparent;
            border: none;

            .mantine-Button-root {
              background-color: transparent;

              &:hover {
                background-color: var(--c--theme--colors--greyscale-100);
              }
            }

            button[role='menuitem'] svg {
              color: var(--c--theme--colors--greyscale-600);
            }
          }

          & svg {
            color: var(--c--theme--colors--info-600);
          }
        }

        // Actions button edit comment
        .bn-container + .bn-comment-actions-wrapper {
          .bn-comment-actions {
            flex-direction: row-reverse;
            background: none;
            border: none;
            gap: 0.4rem !important;

            & > button {
              height: 24px;
              padding-inline: 4px;

              &[data-test='save'] {
                border: 1px solid var(--c--theme--colors--info-600);
                background: var(--c--theme--colors--info-600);
                color: white;
              }

              &[data-test='cancel'] {
                background: white;
                border: 1px solid var(--c--theme--colors--greyscale-300);
                color: var(--c--theme--colors--info-600);
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
          background-image: ${currentUserAvatarUrl
            ? `url("${currentUserAvatarUrl}")`
            : 'none'};
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
        }
      }

      // Actions button send comment
      .bn-thread-composer .bn-comment-actions-wrapper,
      &:not(.selected) .bn-comment-actions-wrapper {
        flex-basis: fit-content;

        .bn-action-toolbar.bn-comment-actions {
          border: none;

          button {
            font-size: 0;
            background: var(--c--theme--colors--info-600);
            width: 24px;
            height: 24px;
            padding: 0;

            &:disabled {
              background: var(--c--theme--colors--greyscale-300);
            }

            & .mantine-Button-label::before {
              content: '🡡';
              font-size: 13px;
              color: var(--c--theme--colors--greyscale-100);
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
`;
