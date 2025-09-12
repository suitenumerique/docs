import { css } from 'styled-components';

export const cssComments = (canSeeComment: boolean) => css`
  & .--docs--main-editor,
  & .--docs--main-editor .ProseMirror {
    .bn-editor {
      .bn-thread-mark:not([data-orphan='true']),
      .bn-thread-mark-selected:not([data-orphan='true']) {
        background: ${canSeeComment ? '#F4D261' : 'transparent'};
        color: var(--c--theme--colors--greyscale-700);
      }
    }

    .bn-thread {
      max-width: 400px;
      max-height: 500px;
      overflow: auto;
      width: 100%;
      padding: 0.4rem;

      // to allow popovers to escape the thread container
      &:has(em-emoji-picker) {
        max-height: none;
        overflow: visible;
      }

      .bn-thread-comment {
        padding: 0.5rem 1rem;

        &:hover,
        &:hover .bn-editor {
          background-color: #fafafa;
        }

        .mantine-Group-root {
          right: 0.3rem !important;
          top: 0.3rem !important;

          .bn-comment-actions {
            background: transparent;
            border: none;

            .mantine-Button-root {
              background-color: transparent;

              &:hover {
                background-color: var(--c--theme--colors--greyscale-100);
              }
            }
          }

          & svg {
            color: var(--c--theme--colors--info-600);
          }
        }
      }

      .bn-thread-composer,
      &:has(> .bn-comment-editor + .bn-comment-actions-wrapper) {
        padding: 0.5rem 1rem;
        flex-direction: row;
      }
    }
  }
`;
