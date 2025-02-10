import {
  BlockNoteSchema,
  Dictionary,
  locales,
  withPageBreak,
} from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import * as Y from 'yjs';

import { Box, TextErrors } from '@/components';
import { useAuth } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

import { useUploadFile } from '../hook';
import { useHeadings } from '../hook/useHeadings';
import useSaveDoc from '../hook/useSaveDoc';
import { useEditorStore } from '../stores';
import { randomColor } from '../utils';

import { BlockNoteSuggestionMenu } from './BlockNoteSuggestionMenu';
import { BlockNoteToolbar } from './BlockNoteToolbar';

const cssEditor = (readonly: boolean) => css`
  &,
  & > .bn-container,
  & .ProseMirror {
    height: 100%;

    .collaboration-cursor-custom__base {
      position: relative;
    }
    .collaboration-cursor-custom__caret {
      position: absolute;
      height: 85%;
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
      padding: 0px 6px;
      border-radius: 0px;
      white-space: nowrap;
      transition: clip-path 0.3s ease-in-out;
      border-radius: 4px 4px 4px 0;
      box-shadow: inset -2px 2px 6px #ffffff88;
      clip-path: polygon(0 100%, 0 100%, 0 100%, 0% 100%);
    }

    .collaboration-cursor-custom__base[data-active]
      .collaboration-cursor-custom__label {
      pointer-events: none;
      clip-path: polygon(0 0, 100% 0%, 100% 100%, 0% 100%);
    }

    .bn-side-menu[data-block-type='heading'][data-level='1'] {
      height: 50px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='2'] {
      height: 43px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='3'] {
      height: 35px;
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
      color: var(--c--theme--colors--greyscale-500);
      cursor: pointer;
    }
    .bn-block-group
      .bn-block-group
      .bn-block-outer:not([data-prev-depth-changed]):before {
      border-left: none;
    }
  }

  .bn-editor {
    color: var(--c--theme--colors--greyscale-700);
  }

  .bn-block-outer:not(:first-child) {
    &:has(h1) {
      padding-top: 32px;
    }
    &:has(h2) {
      padding-top: 24px;
    }
    &:has(h3) {
      padding-top: 16px;
    }
  }

  & .bn-inline-content code {
    background-color: gainsboro;
    padding: 2px;
    border-radius: 4px;
  }

  @media screen and (width <= 560px) {
    & .bn-editor {
      ${readonly && `padding-left: 10px;`}
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

export const blockNoteSchema = withPageBreak(BlockNoteSchema.create());

interface BlockNoteEditorProps {
  doc: Doc;
  provider: HocuspocusProvider;
}

export const BlockNoteEditor = ({ doc, provider }: BlockNoteEditorProps) => {
  const { user } = useAuth();
  const { setEditor } = useEditorStore();
  const { t } = useTranslation();

  const readOnly = !doc.abilities.partial_update;
  useSaveDoc(doc.id, provider.document, !readOnly);
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const { uploadFile, errorAttachment } = useUploadFile(doc.id);

  const collabName = readOnly
    ? 'Reader'
    : user?.full_name || user?.email || t('Anonymous');
  const showCursorLabels: 'always' | 'activity' | (string & {}) = 'activity';

  const editor = useCreateBlockNote(
    {
      collaboration: {
        provider,
        fragment: provider.document.getXmlFragment('document-store'),
        user: {
          name: collabName,
          color: randomColor(),
        },
        /**
         * We render the cursor with a custom element to:
         * - fix rendering issue with the default cursor
         * - hide the cursor when anonymous users
         */
        renderCursor: (user: { color: string; name: string }) => {
          const cursorElement = document.createElement('span');

          if (user.name === 'Reader') {
            return cursorElement;
          }

          cursorElement.classList.add('collaboration-cursor-custom__base');
          const caretElement = document.createElement('span');
          caretElement.classList.add('collaboration-cursor-custom__caret');
          caretElement.setAttribute('spellcheck', `false`);
          caretElement.setAttribute('style', `background-color: ${user.color}`);

          if (showCursorLabels === 'always') {
            cursorElement.setAttribute('data-active', '');
          }

          const labelElement = document.createElement('span');

          labelElement.classList.add('collaboration-cursor-custom__label');
          labelElement.setAttribute('spellcheck', `false`);
          labelElement.setAttribute(
            'style',
            `background-color: ${user.color};border: 1px solid ${user.color};`,
          );
          labelElement.insertBefore(document.createTextNode(user.name), null);

          caretElement.insertBefore(labelElement, null);

          cursorElement.insertBefore(document.createTextNode('\u2060'), null); // Non-breaking space
          cursorElement.insertBefore(caretElement, null);
          cursorElement.insertBefore(document.createTextNode('\u2060'), null); // Non-breaking space

          return cursorElement;
        },
        showCursorLabels: showCursorLabels as 'always' | 'activity',
      },
      dictionary: locales[lang as keyof typeof locales] as Dictionary,
      uploadFile,
      schema: blockNoteSchema,
    },
    [collabName, lang, provider, uploadFile],
  );
  useHeadings(editor);

  useEffect(() => {
    setEditor(editor);

    return () => {
      setEditor(undefined);
    };
  }, [setEditor, editor]);

  return (
    <Box
      $padding={{ top: 'md' }}
      $background="white"
      $css={cssEditor(readOnly)}
    >
      {errorAttachment && (
        <Box $margin={{ bottom: 'big' }}>
          <TextErrors
            causes={errorAttachment.cause}
            canClose
            $textAlign="left"
          />
        </Box>
      )}

      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        editable={!readOnly}
        theme="light"
      >
        <BlockNoteToolbar />
        <BlockNoteSuggestionMenu />
      </BlockNoteView>
    </Box>
  );
};

interface BlockNoteEditorVersionProps {
  initialContent: Y.XmlFragment;
}

export const BlockNoteEditorVersion = ({
  initialContent,
}: BlockNoteEditorVersionProps) => {
  const readOnly = true;
  const { setEditor } = useEditorStore();
  const editor = useCreateBlockNote(
    {
      collaboration: {
        fragment: initialContent,
        user: {
          name: '',
          color: '',
        },
        provider: undefined,
      },
      schema: blockNoteSchema,
    },
    [initialContent],
  );
  useHeadings(editor);

  useEffect(() => {
    setEditor(editor);

    return () => {
      setEditor(undefined);
    };
  }, [setEditor, editor]);

  return (
    <Box $css={cssEditor(readOnly)}>
      <BlockNoteView editor={editor} editable={!readOnly} theme="light" />
    </Box>
  );
};
