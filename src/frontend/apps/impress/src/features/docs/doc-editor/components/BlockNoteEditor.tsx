import { Dictionary, locales } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Box, TextErrors } from '@/components';
import { useAuthStore } from '@/core/auth';
import { Doc } from '@/features/docs/doc-management';

import { useUploadFile } from '../hook';
import { useHeadings } from '../hook/useHeadings';
import useSaveDoc from '../hook/useSaveDoc';
import { useEditorStore } from '../stores';
import { randomColor } from '../utils';

import { BlockNoteToolbar } from './BlockNoteToolbar';

const cssEditor = (readonly: boolean) => `
  &, & > .bn-container, & .ProseMirror {
    height:100%;
    
      .bn-side-menu[data-block-type=heading][data-level="1"] { 
         height: 50px; 
     } 
     .bn-side-menu[data-block-type=heading][data-level="2"] { 
       height: 43px; 
     } 
    .bn-side-menu[data-block-type=heading][data-level="3"] {
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
  };
  
  & .bn-inline-content code {
    background-color: gainsboro;
    padding: 2px;
    border-radius: 4px;
  }
  @media screen and (width <= 560px) {
    & .bn-editor {
      
      ${readonly && `padding-left: 10px;`}
    };
    .bn-side-menu[data-block-type=heading][data-level="1"] {
        height: 46px;
    }
    .bn-side-menu[data-block-type=heading][data-level="2"] {
      height: 40px;
    }
    .bn-side-menu[data-block-type=heading][data-level="3"] {
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
    .bn-block-content[data-is-empty-and-focused][data-content-type="paragraph"] 
      .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
      font-size: 14px;
    }
  }
`;

interface BlockNoteEditorProps {
  doc: Doc;
  provider: HocuspocusProvider;
}

export const BlockNoteEditor = ({ doc, provider }: BlockNoteEditorProps) => {
  const { userData } = useAuthStore();
  const { setEditor } = useEditorStore();
  const { t } = useTranslation();

  const readOnly = !doc.abilities.partial_update;
  useSaveDoc(doc.id, provider.document, !readOnly);
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const { uploadFile, errorAttachment } = useUploadFile(doc.id);

  const collabName = readOnly
    ? 'Reader'
    : userData?.full_name || userData?.email || t('Anonymous');

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
         * We re-use the blocknote code to render the cursor but we:
         * - fix rendering issue with Firefox
         * - We don't want to show the cursor when anonymous users
         */
        renderCursor: (user: { color: string; name: string }) => {
          const cursor = document.createElement('span');

          if (user.name === 'Reader') {
            return cursor;
          }

          cursor.classList.add('collaboration-cursor__caret');
          cursor.setAttribute('style', `border-color: ${user.color}`);

          const label = document.createElement('span');

          label.classList.add('collaboration-cursor__label');
          label.setAttribute('style', `background-color: ${user.color}`);
          label.insertBefore(document.createTextNode(user.name), null);

          cursor.insertBefore(label, null);

          return cursor;
        },
      },
      dictionary: locales[lang as keyof typeof locales] as Dictionary,
      uploadFile,
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
    <Box $css={cssEditor(readOnly)}>
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
        editable={!readOnly}
        theme="light"
      >
        <BlockNoteToolbar />
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
