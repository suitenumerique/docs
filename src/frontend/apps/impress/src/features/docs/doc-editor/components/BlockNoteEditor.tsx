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
import * as localesBN from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {
  FloatingComposerController,
  FloatingThreadController,
  ThreadsSidebar,
  useCreateBlockNote,
} from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { Box, TextErrors } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import {
  DocsCommentsStyle,
  useCommentSidebarStore,
  useComments,
} from '@/docs/doc-comments';
import { Doc } from '@/docs/doc-management';
import { avatarUrlFromName, useAuth } from '@/features/auth';
import { useRightPanelStore } from '@/features/right-panel/stores/useRightPanelStore';
import { useAnalytics } from '@/libs/Analytics';

import { AI_FEATURE_FLAG, DEFAULT_LOCALE } from '../conf';
import {
  useHeadings,
  useSaveDoc,
  useShortcuts,
  useUploadFile,
  useUploadStatus,
} from '../hook';
import { useEditorStore } from '../stores';
import { DocsEditorStyle } from '../styles';
import { DocsBlockNoteEditor } from '../types';
import { randomColor, sanitizeColor } from '../utils';

import BlockNoteAI from './AI';
import { BlockNoteSuggestionMenu } from './BlockNoteSuggestionMenu';
import { BlockNoteToolbar } from './BlockNoteToolBar/BlockNoteToolbar';
import { CalloutBlock, PdfBlock, UploadLoaderBlock } from './custom-blocks';
const AIMenu = BlockNoteAI?.AIMenu;
const AIMenuController = BlockNoteAI?.AIMenuController;
const useAI = BlockNoteAI?.useAI;
const localesBNAI = BlockNoteAI?.localesAI || {};
import { InterlinkingLinkInlineContent } from './custom-inline-content';
import XLMultiColumn from './xl-multi-column';

const localesBNMultiColumn = XLMultiColumn?.locales;
const withMultiColumn = XLMultiColumn?.withMultiColumn;

const baseBlockNoteSchema = withPageBreak(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: CalloutBlock(),
      codeBlock: createCodeBlockSpec(codeBlockOptions),
      pdf: PdfBlock(),
      uploadLoader: UploadLoaderBlock(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
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
  const refEditorContainer = useRef<HTMLDivElement>(null);
  useSaveDoc(doc.id, provider.document);

  const { i18n, t } = useTranslation();
  const langLocalesBN =
    !i18n.resolvedLanguage || !(i18n.resolvedLanguage in localesBN)
      ? DEFAULT_LOCALE
      : i18n.resolvedLanguage;
  const langLocalesBNMultiColumn =
    !i18n.resolvedLanguage ||
    !localesBNMultiColumn ||
    !(i18n.resolvedLanguage in localesBNMultiColumn)
      ? DEFAULT_LOCALE
      : i18n.resolvedLanguage;
  const langLocalesBNAI =
    !i18n.resolvedLanguage || !(i18n.resolvedLanguage in localesBNAI)
      ? DEFAULT_LOCALE
      : i18n.resolvedLanguage;

  const { uploadFile, errorAttachment } = useUploadFile(doc.id);
  const conf = useConfig().data;
  const { isFeatureFlagActivated } = useAnalytics();
  const aiBlockNoteAllowed = !!(
    conf?.AI_FEATURE_ENABLED &&
    conf?.AI_FEATURE_BLOCKNOTE_ENABLED &&
    isFeatureFlagActivated(AI_FEATURE_FLAG) &&
    doc.abilities?.ai_proxy
  );
  const aiExtension = useAI?.(doc.id, aiBlockNoteAllowed);

  const collabName = user?.full_name || user?.email;
  const cursorName = collabName || t('Anonymous');
  const showCursorLabels: 'always' | 'activity' | (string & {}) = 'activity';

  // Comments
  const canSeeComment = doc.abilities.comment;
  const showComments = canSeeComment; // Determine if comments should be visible in the UI
  const { resolveUsers, threadStore } = useComments(
    doc.id,
    canSeeComment,
    user,
  );

  // Comment sidebar
  const { threadsSidebarTarget, filter: threadsSidebarFilter } =
    useCommentSidebarStore();
  const { activePanel, isPanelOpen } = useRightPanelStore();
  const isCommentSideBarOpen = isPanelOpen && activePanel === 'comments';

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
          const safeColor = sanitizeColor(user.color);

          cursorElement.classList.add('collaboration-cursor-custom__base');
          const caretElement = document.createElement('span');
          caretElement.classList.add('collaboration-cursor-custom__caret');
          caretElement.setAttribute('spellcheck', `false`);
          caretElement.setAttribute('style', `background-color: ${safeColor}`);

          if (showCursorLabels === 'always') {
            cursorElement.setAttribute('data-active', '');
          }

          const labelElement = document.createElement('span');

          labelElement.classList.add('collaboration-cursor-custom__label');
          labelElement.setAttribute('spellcheck', `false`);
          labelElement.setAttribute(
            'style',
            `background-color: ${safeColor};border: 1px solid ${safeColor};`,
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
        ...localesBN[langLocalesBN as keyof typeof localesBN],
        ...(localesBNMultiColumn && {
          multi_column:
            localesBNMultiColumn[
              langLocalesBNMultiColumn as keyof typeof localesBNMultiColumn
            ],
          ai: localesBNAI?.[langLocalesBNAI as keyof typeof localesBNAI],
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
      langLocalesBN,
      langLocalesBNMultiColumn,
      langLocalesBNAI,
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
    <Box ref={refEditorContainer} $height="100%">
      <DocsEditorStyle />
      <DocsCommentsStyle
        canSeeComment={canSeeComment}
        currentUserAvatarUrl={currentUserAvatarUrl}
      />
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
        comments={false}
        aria-label={t('Document editor')}
        // To not clipped the floating part in the editor area
        portalElements={{ default: null }}
      >
        {aiBlockNoteAllowed && AIMenuController && AIMenu && (
          <AIMenuController aiMenu={AIMenu} />
        )}
        <BlockNoteSuggestionMenu aiAllowed={aiBlockNoteAllowed} />
        <BlockNoteToolbar aiAllowed={aiBlockNoteAllowed} />
        {showComments && <FloatingComposerController />}
        {showComments && !isCommentSideBarOpen && <FloatingThreadController />}
        {threadsSidebarTarget &&
          createPortal(
            <ThreadsSidebar
              filter={threadsSidebarFilter}
              sort="recent-activity"
            />,
            threadsSidebarTarget,
          )}
      </BlockNoteView>
    </Box>
  );
};

interface BlockNoteReaderProps {
  docId: Doc['id'];
  initialContent: Y.XmlFragment;
  isMainEditor?: boolean;
}

export const BlockNoteReader = ({
  docId,
  initialContent,
  isMainEditor = true,
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
    if (!isMainEditor) {
      return;
    }

    setEditor(editor);

    return () => {
      if (!isMainEditor) {
        return;
      }
      setEditor(undefined);
    };
  }, [setEditor, editor, isMainEditor]);

  useHeadings(editor);

  return (
    <Box>
      <DocsEditorStyle />
      <DocsCommentsStyle canSeeComment={false} />
      <BlockNoteView
        className="--docs--main-editor"
        editor={editor}
        editable={false}
        theme="light"
        formattingToolbar={false}
        slashMenu={false}
        comments={false}
      >
        <BlockNoteToolbar aiAllowed={false} />
      </BlockNoteView>
    </Box>
  );
};
