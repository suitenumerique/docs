import { syntaxHighlighter } from '@blocknote/code-block';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  withPageBreak,
} from '@blocknote/core';
import { CommentsExtension } from '@blocknote/core/comments';
import { type VersioningController } from '@blocknote/core/extensions';
import '@blocknote/core/fonts/inter.css';
import * as localesBN from '@blocknote/core/locales';
import { YVersioningExtension, withCollaboration } from '@blocknote/core/y';
import {
  createReactDiagramBlockSpec,
  locales as diagramLocales,
} from '@blocknote/diagram-block';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {
  createReactInlineMathSpec,
  createReactMathBlockSpec,
  locales as mathLocales,
} from '@blocknote/math-block';
import {
  FloatingComposerController,
  FloatingThreadController,
  ReactAudioBlock,
  ReactFileBlock,
  ReactImageBlock,
  ReactVideoBlock,
  ThreadsSidebar,
  useCreateBlockNote,
} from '@blocknote/react';
import { FindAndReplace } from '@tiptap/extension-find-and-replace';
import { WebsocketProvider } from '@y/websocket';
import * as Y from '@y/y';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useConfig } from '@/core';
import { collaborationHttpTarget } from '@/core/config/hooks/useCollaborationUrl';
import { useCunninghamTheme } from '@/cunningham';
import {
  DocsCommentsStyle,
  useCommentSidebarStore,
  useComments,
} from '@/docs/doc-comments';
import { DocsFindReplaceStyle } from '@/docs/doc-find-replace/styles';
import { type Doc } from '@/docs/doc-management/types';
import { useDocUserStore, userColorsForId } from '@/docs/doc-share';
import { avatarUrlFromName, useAuth } from '@/features/auth';
import { userColorForeground } from '@/features/auth/userColors';
import { useRightPanelStore } from '@/features/right-panel/stores/useRightPanelStore';
import { useAnalytics } from '@/libs/Analytics';

import { authorOnlyAttribution } from '../authorOnlyAttribution';
import { AI_FEATURE_FLAG, DEFAULT_LOCALE } from '../conf';
import { createDocsVersionStorage } from '../createDocsVersionStorage';
import {
  useHeadings,
  useScrollToBlockAnchor,
  useShortcuts,
  useUploadFile,
  useUploadStatus,
} from '../hook';
import { useEditorStore } from '../stores';
import { useVersioningSidebarStore } from '../stores/useVersioningSidebarStore';
import { DocsEditorStyle } from '../styles';
import { type DocsBlockNoteEditor } from '../types';
import { sanitizeColor } from '../utils';

import BlockNoteAI from './AI';
import { BlockNoteSuggestionMenu } from './BlockNoteSuggestionMenu';
import { BlockNoteToolbar } from './BlockNoteToolBar/BlockNoteToolbar';
import { DocsSideMenu } from './DocsSideMenu/DocsSideMenu';
import { type HistoryDebugSettings } from './VersionHistoryDebug';
import { VersioningComponentsProvider } from './VersioningComponentsProvider';
import { VersioningSidebarPanel } from './VersioningSidebarPanel';
import { CalloutBlock, PdfBlock, UploadLoaderBlock } from './custom-blocks';
const AIMenu = BlockNoteAI?.AIMenu;
const AIMenuController = BlockNoteAI?.AIMenuController;
const useAI = BlockNoteAI?.useAI;
const localesBNAI = BlockNoteAI?.localesAI || {};
import { createSafeCodeBlockSpec } from './custom-blocks/CodeBlock';
import {
  InterlinkingLinkInlineContent,
  getPastedDocInterlink,
} from './custom-inline-content';
import XLMultiColumn from './xl-multi-column';

const localesBNMultiColumn = XLMultiColumn?.locales;
const withMultiColumn = XLMultiColumn?.withMultiColumn;
const MIN_VERSION_GRANULARITY_MS = 5 * 60_000;

const baseBlockNoteSchema = withPageBreak(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      audio: ReactAudioBlock(),
      file: ReactFileBlock(),
      image: ReactImageBlock(),
      video: ReactVideoBlock(),
      callout: CalloutBlock(),
      codeBlock: createSafeCodeBlockSpec(),
      diagram: createReactDiagramBlockSpec(),
      mathBlock: createReactMathBlockSpec(),
      pdf: PdfBlock(),
      uploadLoader: UploadLoaderBlock(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      interlinkingLinkInline: InterlinkingLinkInlineContent,
      math: createReactInlineMathSpec(),
    },
  }),
);

export const blockNoteSchema = (withMultiColumn?.(baseBlockNoteSchema) ||
  baseBlockNoteSchema) as typeof baseBlockNoteSchema;

interface BlockNoteEditorProps {
  doc: Doc;
  provider: WebsocketProvider;
}

export const BlockNoteEditor = ({ doc, provider }: BlockNoteEditorProps) => {
  const { user } = useAuth();
  const { setEditor } = useEditorStore();
  const { themeTokens } = useCunninghamTheme();
  const refEditorContainer = useRef<HTMLDivElement>(null);

  const { i18n, t } = useTranslation();
  const {
    isOpen: isVersioningSidebarOpen,
    setIsOpen: setIsVersioningSidebarOpen,
  } = useVersioningSidebarStore();
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
  // The math and diagram blocks ship the same set of locales.
  const langLocalesBNMathDiagram =
    !i18n.resolvedLanguage || !(i18n.resolvedLanguage in mathLocales)
      ? DEFAULT_LOCALE
      : i18n.resolvedLanguage;

  const { uploadFile } = useUploadFile(doc.id);
  const conf = useConfig().data;
  const { isFeatureFlagActivated } = useAnalytics();
  const aiBlockNoteAllowed = !!(
    conf?.AI_FEATURE_ENABLED &&
    conf?.AI_FEATURE_BLOCKNOTE_ENABLED &&
    isFeatureFlagActivated(AI_FEATURE_FLAG) &&
    doc.abilities?.ai_proxy
  );
  const aiExtension = useAI?.(doc.id, aiBlockNoteAllowed);
  const versionGranularityMs = Math.max(
    conf?.COLLABORATION_VERSION_GRANULARITY_MS ?? MIN_VERSION_GRANULARITY_MS,
    MIN_VERSION_GRANULARITY_MS,
  );
  const historyDebugSettings = useRef<HistoryDebugSettings | undefined>(
    undefined,
  );
  const historyDefaults = {
    groupMaxGap: versionGranularityMs,
    groupMaxDuration: versionGranularityMs,
    limit: 50,
  };

  const collabName = user?.full_name || user?.email;
  const cursorName =
    collabName ||
    t('Anonymous', {
      description: 'Display name of a user without a known name',
    });
  const showCursorLabels: 'always' | 'activity' | (string & {}) = 'activity';

  // Comments
  const canSeeComment = doc.abilities.comment;
  const showComments = canSeeComment; // Determine if comments should be visible in the UI
  const { resolveUsers, threadStore } = useComments(
    doc.id,
    canSeeComment,
    user,
  );
  // Resolve author ids stored in the document (versioning, suggestions) to users.
  const docUserStore = useDocUserStore(doc.id);

  // Comment sidebar
  const { threadsSidebarTarget, filter: threadsSidebarFilter } =
    useCommentSidebarStore();
  const { activePanel, isPanelOpen } = useRightPanelStore();
  const isCommentSideBarOpen = isPanelOpen && activePanel === 'comments';

  const currentUserAvatarUrl = useMemo(() => {
    if (canSeeComment) {
      return avatarUrlFromName(
        collabName,
        themeTokens?.font?.families?.base,
        user?.id ?? 'anonymous',
      );
    }
  }, [canSeeComment, collabName, themeTokens?.font?.families?.base, user?.id]);

  const collabTarget = useMemo(() => {
    if (!provider.serverUrl) {
      return undefined;
    }
    return collaborationHttpTarget(provider.serverUrl);
  }, [provider.serverUrl]);

  const versioningExtension = useMemo(() => {
    if (!collabTarget) {
      return undefined;
    }
    const storage = createDocsVersionStorage({
      baseUrl: collabTarget.serverUrl,
      org: collabTarget.org,
      docId: doc.id,
      fragment: provider.doc.get('document-store'),
      beforeRestoreName:
        localesBN[langLocalesBN as keyof typeof localesBN].versioning
          .before_restore,
      // Read overrides for each request, without reinstalling the editor.
      get activityParams() {
        return {
          group: true,
          groupByUser: false,
          ...(historyDebugSettings.current ?? {
            groupMaxGap: versionGranularityMs,
            groupMaxDuration: versionGranularityMs,
            limit: 50,
          }),
        };
      },
    });
    return YVersioningExtension({ storage });
  }, [collabTarget, doc.id, langLocalesBN, provider.doc, versionGranularityMs]);

  const editor: DocsBlockNoteEditor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        provider,
        fragment: provider.doc.get('document-store'),
        user: {
          id: user?.id ?? 'anonymous',
          name: cursorName,
          color: userColorsForId(user?.id ?? 'anonymous').color,
        },
        resolveUsers: docUserStore,
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
            `background-color: ${safeColor};border: 1px solid ${safeColor};color: ${userColorForeground(safeColor)};`,
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
      dropCursor: {
        color: 'var(--c--contextuals--background--semantic--brand--tertiary)',
      },
      dictionary: {
        ...localesBN[langLocalesBN as keyof typeof localesBN],
        suggestion_changes: authorOnlyAttribution(
          localesBN[langLocalesBN as keyof typeof localesBN].suggestion_changes,
        ),
        math: mathLocales[langLocalesBNMathDiagram as keyof typeof mathLocales],
        diagram:
          diagramLocales[
            langLocalesBNMathDiagram as keyof typeof diagramLocales
          ],
        ...(localesBNMultiColumn && {
          multi_column:
            localesBNMultiColumn[
              langLocalesBNMultiColumn as keyof typeof localesBNMultiColumn
            ],
          ai: localesBNAI?.[langLocalesBNAI as keyof typeof localesBNAI],
        }),
      },
      pasteHandler: ({ event, editor: pasteEditor, defaultPasteHandler }) => {
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

        /**
         * When pasting a bare link to a doc on this same domain, turn it
         * into an interlink instead of a plain link, so it benefits from
         * the title-sync and navigation behaviour of the interlinking system.
         */
        const pastedInterlink = getPastedDocInterlink(
          event,
          pasteEditor as DocsBlockNoteEditor,
        );
        if (pastedInterlink?.docId) {
          editor.insertInlineContent([
            {
              type: 'interlinkingLinkInline',
              props: {
                docId: pastedInterlink.docId,
                ...(pastedInterlink.blockId && {
                  blockId: pastedInterlink.blockId,
                }),
              },
            },
          ]);
          return true;
        }

        return defaultPasteHandler();
      },
      extensions: [
        // Highlights the source of code blocks and of the math / diagram
        // blocks' editable LaTeX / Mermaid popups.
        syntaxHighlighter,
        ...(versioningExtension ? [versioningExtension] : []),
        CommentsExtension({ threadStore, resolveUsers }),
        ...(aiExtension ? [aiExtension] : []),
      ],
      _tiptapOptions: {
        extensions: [
          FindAndReplace.configure({
            injectCSS: false,
          }),
        ],
      },
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
      setIdAttribute: true,
      uploadFile,
      schema: blockNoteSchema,
    }),
    [
      aiExtension,
      cursorName,
      docUserStore,
      langLocalesBN,
      langLocalesBNMultiColumn,
      langLocalesBNAI,
      langLocalesBNMathDiagram,
      provider,
      uploadFile,
      threadStore,
      resolveUsers,
      versioningExtension,
    ],
  );

  useHeadings(editor);

  useShortcuts(editor, refEditorContainer.current);

  useUploadStatus(editor);

  useScrollToBlockAnchor();

  useEffect(() => {
    setEditor(editor);

    return () => {
      setEditor(undefined);
    };
  }, [setEditor, editor]);

  return (
    <Box
      ref={refEditorContainer}
      $height="100%"
      style={{ position: 'relative' }}
    >
      <DocsEditorStyle />
      <DocsCommentsStyle
        canSeeComment={canSeeComment}
        currentUserAvatarUrl={currentUserAvatarUrl}
      />
      <DocsFindReplaceStyle />
      <BlockNoteView
        className="--docs--main-editor"
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
        theme="light"
        comments={false}
        aria-label={t('Document editor', {
          description: 'Accessible name of the editor area',
        })}
        // To not clipped the floating part in the editor area
        portalElements={{ default: 'body' }}
      >
        {aiBlockNoteAllowed && AIMenuController && AIMenu && (
          <AIMenuController aiMenu={AIMenu} />
        )}
        <BlockNoteSuggestionMenu aiAllowed={aiBlockNoteAllowed} />
        <BlockNoteToolbar aiAllowed={aiBlockNoteAllowed} />
        <DocsSideMenu />
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
        {isVersioningSidebarOpen && (
          <VersioningComponentsProvider>
            <VersioningSidebarPanel
              key={doc.id}
              onClose={() => setIsVersioningSidebarOpen(false)}
              debug={{
                defaults: historyDefaults,
                initialSettings:
                  historyDebugSettings.current ?? historyDefaults,
                canCreate: !!doc.abilities.partial_update,
                onApply: async (settings) => {
                  historyDebugSettings.current = settings;
                  const mode =
                    editor.getExtension<VersioningController>('versioning');
                  return mode ? mode.list() : { status: 'unavailable' };
                },
                onCreate: async () => {
                  const mode =
                    editor.getExtension<VersioningController>('versioning');
                  if (!mode || !doc.abilities.partial_update) {
                    return { status: 'unavailable' };
                  }
                  const latest = mode.store.state;
                  if (
                    latest.mode === 'versions' &&
                    latest.history.data?.[0]?.name
                  ) {
                    return { status: 'error', error: { type: 'conflict' } };
                  }
                  return mode.create(
                    t('Test version · {{time}}', {
                      time: new Date().toLocaleTimeString(),
                    }),
                  );
                },
              }}
            />
          </VersioningComponentsProvider>
        )}
      </BlockNoteView>
    </Box>
  );
};

interface BlockNoteReaderProps {
  docId: Doc['id'];
  initialContent: Y.Node;
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
    withCollaboration({
      collaboration: {
        fragment: initialContent,
        user: {
          id: '',
          name: '',
          color: '',
        },
        provider: undefined,
      },
      setIdAttribute: true,
      schema: blockNoteSchema,
      extensions: [
        CommentsExtension({
          threadStore,
          resolveUsers: async () => {
            return Promise.resolve([]);
          },
        }),
      ],
    }),
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

  useScrollToBlockAnchor();

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
