import { codeBlockOptions } from '@blocknote/code-block';
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  withPageBreak,
} from '@blocknote/core';
import { CommentsExtension } from '@blocknote/core/comments';
import '@blocknote/core/fonts/inter.css';
import * as locales from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { Box, TextErrors } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, useProviderStore } from '@/docs/doc-management';
import { avatarUrlFromName, useAuth } from '@/features/auth';

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

import BlockNoteAI from './AI';
import { BlockNoteSuggestionMenu } from './BlockNoteSuggestionMenu';
import { BlockNoteToolbar } from './BlockNoteToolBar/BlockNoteToolbar';
import { cssComments, useComments } from './comments/';
import {
  AccessibleImageBlock,
  CalloutBlock,
  PdfBlock,
  UploadLoaderBlock,
} from './custom-blocks';

const AIMenu = BlockNoteAI?.AIMenu;
const AIMenuController = BlockNoteAI?.AIMenuController;
const useAI = BlockNoteAI?.useAI;
const localesAI = BlockNoteAI?.localesAI;
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
  const { themeTokens } = useCunninghamTheme();
  const { isSynced: isConnectedToCollabServer } = useProviderStore();
  const refEditorContainer = useRef<HTMLDivElement>(null);
  const canSeeComment = doc.abilities.comment;
  // Determine if comments should be visible in the UI
  const showComments = canSeeComment;

  useSaveDoc(doc.id, provider.document, isConnectedToCollabServer);
  const { i18n, t } = useTranslation();
  let lang = i18n.resolvedLanguage;
  if (!lang || !(lang in locales)) {
    lang = 'en';
  }

  const { uploadFile, errorAttachment } = useUploadFile(doc.id);
  const aiExtension = useAI?.(doc.id);

  const collabName = user?.full_name || user?.email;
  const cursorName = collabName || t('Anonymous');
  const showCursorLabels: 'always' | 'activity' | (string & {}) = 'activity';

  const { resolveUsers, threadStore } = useComments(
    doc.id,
    canSeeComment,
    user,
  );

  const currentUserAvatarUrl = useMemo(() => {
    if (canSeeComment) {
      return avatarUrlFromName(collabName, themeTokens?.font?.families?.base);
    }
  }, [canSeeComment, collabName, themeTokens?.font?.families?.base]);

  const editor: DocsBlockNoteEditor = useCreateBlockNote(
    {
      collaboration: {
        provider: provider as { awareness?: Awareness | undefined },
        fragment: provider.document.getXmlFragment('document-store'),
        user: {
          name: cursorName,
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
      dictionary: {
        ...locales[lang as keyof typeof locales],
        ...(multiColumnLocales && {
          multi_column:
            multiColumnLocales[lang as keyof typeof multiColumnLocales],
          ai: localesAI?.[lang as keyof typeof localesAI],
        }),
      },
      pasteHandler: ({ event, defaultPasteHandler }) => {
        // Get clipboard data
        const blocknoteData = event.clipboardData?.getData('blocknote/html');

        /**
         * When pasting comments, the data-bn-thread-id
         * attribute is present in the clipboard data.
         * This indicates that the pasted content contains comments.
         * But if the content with comments comes from another document,
         * it will create orphaned comments that are not linked to this document
         * and create errors.
         * To avoid this, we refresh the threads to ensure that only comments
         * relevant to the current document are displayed.
         */
        if (blocknoteData && blocknoteData.includes('data-bn-thread-id')) {
          void threadStore.refreshThreads();
        }

        return defaultPasteHandler();
      },
      extensions: [
        CommentsExtension({ threadStore, resolveUsers }),
        ...(aiExtension ? [aiExtension] : []),
      ],
      visualMedia: {
        image: {
          maxWidth: 760,
        },
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
    [
      aiExtension,
      cursorName,
      lang,
      provider,
      uploadFile,
      threadStore,
      resolveUsers,
    ],
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
        ${cssComments(showComments, currentUserAvatarUrl)}
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
        comments={showComments}
        aria-label={t('Document editor')}
      >
        {aiExtension && AIMenuController && AIMenu && (
          <AIMenuController aiMenu={AIMenu} />
        )}
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
  const { threadStore } = useComments(docId, false, user);
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
      extensions: [
        CommentsExtension({
          threadStore,
          resolveUsers: async () => {
            return Promise.resolve([]);
          },
        }),
      ],
    },
    [initialContent, threadStore],
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
        formattingToolbar={false}
        slashMenu={false}
        comments={false}
      >
        <BlockNoteToolbar />
      </BlockNoteView>
    </Box>
  );
};
