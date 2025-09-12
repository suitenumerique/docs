import { codeBlockOptions } from '@blocknote/code-block';
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  withPageBreak,
} from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import * as locales from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import * as Y from 'yjs';

import { Box, TextErrors } from '@/components';
import { Doc, useProviderStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

import {
  useHeadings,
  useSaveDoc,
  useShortcuts,
  useUploadFile,
  useUploadStatus,
} from '../hook';
import { useEditorStore } from '../stores';
import { cssEditor } from '../styles';
import { DocsBlockNoteEditor } from '../types';
import { randomColor } from '../utils';

import { BlockNoteSuggestionMenu } from './BlockNoteSuggestionMenu';
import { BlockNoteToolbar } from './BlockNoteToolBar/BlockNoteToolbar';
import { cssComments, useComments } from './comments/';
import {
  AccessibleImageBlock,
  CalloutBlock,
  PdfBlock,
  UploadLoaderBlock,
} from './custom-blocks';
import {
  InterlinkingLinkInlineContent,
  InterlinkingSearchInlineContent,
} from './custom-inline-content';
import XLMultiColumn from './xl-multi-column';

const multiColumnLocales = XLMultiColumn?.locales;
const withMultiColumn = XLMultiColumn?.withMultiColumn;

const baseBlockNoteSchema = withPageBreak(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: CalloutBlock(),
      codeBlock: createCodeBlockSpec(codeBlockOptions),
      image: AccessibleImageBlock(),
      pdf: PdfBlock(),
      uploadLoader: UploadLoaderBlock(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      interlinkingSearchInline: InterlinkingSearchInlineContent,
      interlinkingLinkInline: InterlinkingLinkInlineContent,
    },
  }),
);

export const blockNoteSchema = (withMultiColumn?.(baseBlockNoteSchema) ||
  baseBlockNoteSchema) as typeof baseBlockNoteSchema;

interface BlockNoteEditorProps {
  doc: Doc;
  provider: HocuspocusProvider;
}

export const BlockNoteEditor = ({ doc, provider }: BlockNoteEditorProps) => {
  const { user } = useAuth();
  const { setEditor } = useEditorStore();
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { isSynced: isConnectedToCollabServer } = useProviderStore();
  const refEditorContainer = useRef<HTMLDivElement>(null);
  const canSeeComment = doc.abilities.comment && isDesktop;

  useSaveDoc(doc.id, provider.document, isConnectedToCollabServer);
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  const { uploadFile, errorAttachment } = useUploadFile(doc.id);

  const collabName = user?.full_name || user?.email || t('Anonymous');
  const showCursorLabels: 'always' | 'activity' | (string & {}) = 'activity';

  const threadStore = useComments(doc.id, canSeeComment, user);

  const editor: DocsBlockNoteEditor = useCreateBlockNote(
    {
      collaboration: {
        provider: provider,
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
      comments: { threadStore },
      dictionary: {
        ...locales[lang as keyof typeof locales],
        multi_column:
          multiColumnLocales?.[lang as keyof typeof multiColumnLocales],
      },
      resolveUsers: async (userIds) => {
        return Promise.resolve(
          userIds.map((encodedURIUserId) => {
            const fullName = decodeURIComponent(encodedURIUserId);

            return {
              id: encodedURIUserId,
              username: fullName || t('Anonymous'),
              avatarUrl: 'https://i.pravatar.cc/300',
            };
          }),
        );
      },
      tables: {
        splitCells: true,
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true,
      },
      uploadFile,
      schema: blockNoteSchema,
    },
    [collabName, lang, provider, uploadFile, threadStore],
  );

  useHeadings(editor);

  useShortcuts(editor, refEditorContainer.current);

  useUploadStatus(editor);

  useEffect(() => {
    setEditor(editor);

    return () => {
      setEditor(undefined);
    };
  }, [setEditor, editor]);

  return (
    <Box
      ref={refEditorContainer}
      $css={css`
        ${cssEditor};
        ${cssComments(canSeeComment)}
      `}
    >
      {errorAttachment && (
        <Box $margin={{ bottom: 'big', top: 'none', horizontal: 'large' }}>
          <TextErrors
            causes={errorAttachment.cause}
            canClose
            $textAlign="left"
          />
        </Box>
      )}
      <BlockNoteView
        className="--docs--main-editor"
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        theme="light"
        comments={canSeeComment}
        aria-label={t('Document editor')}
      >
        <BlockNoteSuggestionMenu />
        <BlockNoteToolbar />
      </BlockNoteView>
    </Box>
  );
};

interface BlockNoteReaderProps {
  docId: Doc['id'];
  initialContent: Y.XmlFragment;
}

export const BlockNoteReader = ({
  docId,
  initialContent,
}: BlockNoteReaderProps) => {
  const { user } = useAuth();
  const { setEditor } = useEditorStore();
  const threadStore = useComments(docId, false, user);
  const { t } = useTranslation();
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
      comments: { threadStore },
      resolveUsers: async () => {
        return Promise.resolve([]);
      },
    },
    [initialContent],
  );

  useEffect(() => {
    setEditor(editor);

    return () => {
      setEditor(undefined);
    };
  }, [setEditor, editor]);

  useHeadings(editor);

  return (
    <Box
      $css={css`
        ${cssEditor};
        ${cssComments(false)}
      `}
    >
      <BlockNoteView
        className="--docs--main-editor"
        editor={editor}
        editable={false}
        theme="light"
        aria-label={t('Document version viewer')}
        formattingToolbar={false}
        slashMenu={false}
        comments={false}
      />
    </Box>
  );
};
