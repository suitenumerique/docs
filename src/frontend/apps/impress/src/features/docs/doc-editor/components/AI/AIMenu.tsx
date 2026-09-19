/**
 * We have to override the default BlockNote AI Menu to customize the items shown to the user.
 *
 * See original implementation:
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-ai/src/components/AIMenu/AIMenu.tsx
 */
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react';
import {
  AIExtension,
  AIMenuSuggestionItem,
  PromptSuggestionMenu,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai';
import '@blocknote/xl-ai/style.css';
import { Button } from '@gouvfr-lasuite/ui-components';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box } from '@/components/Box';
import { Icon } from '@/components/Icon';

import IconWandStar from '../../assets/wand_stars.svg';
import {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

import { IconAI } from './IconAI';

const AIMenuStyle = createGlobalStyle`
  #ai-suggestion-menu .bn-suggestion-menu-item-small .bn-mt-suggestion-menu-item-section[data-position=left] svg {
    height: 18px;
    width: 18px;
  }
  .--docs--ai-menu {
    input[name="ai-prompt"]{
      padding-inline-start: 3rem;
    }
    .mantine-TextInput-wrapper {
      display: flex
    }
    .mantine-TextInput-section[data-position="left"] {
      margin-inline: 0.75rem;
    }
    .mantine-TextInput-section[data-position="right"] {
      inset-inline-end: var(--c--globals--spacings--sm);
      position: relative;
      flex-shrink: 0;
      width: auto;
    }
  }
`;

const SELECTION_CONTEXT_CHARS = 60;

/**
 * Purely descriptive facts about the current selection -- no instructions on
 * what to do with them. What the model should *do* with these fields (which
 * block to edit, how to resolve a repeated occurrence) belongs in the server
 * system prompt (BLOCKNOTE_TOOL_STRICT_PROMPT), not duplicated here: this
 * keeps the per-request context free of command-like phrasing that could
 * bias or conflict with whatever the user actually asks for.
 *
 * Reads from `editor.prosemirrorState` rather than the DOM `Selection` API:
 * BlockNote makes the editor non-editable as soon as the AI menu opens,
 * which detaches the browser's native selection from the editor's own
 * (still-accurate) ProseMirror selection state -- verified live, using
 * `window.getSelection()` here returned the wrong range (or none at all).
 */
function describeSelection(
  editor: DocsBlockNoteEditor,
  selectedText: string,
): string | null {
  const lines = [`Selected text: "${selectedText}"`];

  try {
    lines.push(
      `Selected block id: ${editor.getTextCursorPosition().block.id}$`,
    );
  } catch {
    // Best-effort: still send the selected text on its own below.
  }

  try {
    const { doc, selection } = editor.prosemirrorState;
    const { from, to } = selection;
    const before = doc.textBetween(
      Math.max(0, from - SELECTION_CONTEXT_CHARS),
      from,
      '\n',
    );
    const after = doc.textBetween(
      to,
      Math.min(doc.content.size, to + SELECTION_CONTEXT_CHARS),
      '\n',
    );
    if (before || after) {
      lines.push(
        `Text surrounding the selection, with the exact selection marked ` +
          `<<< >>>: ${before}<<<${selectedText}>>>${after}`,
      );
    }
  } catch {
    // Best-effort: the block id and bare text above are still useful alone.
  }

  return lines.join('\n');
}

export type AIMenuProps = {
  items?: (
    editor: DocsBlockNoteEditor,
    aiResponseStatus:
      | 'user-input'
      | 'thinking'
      | 'ai-writing'
      | 'error'
      | 'user-reviewing'
      | 'closed',
  ) => AIMenuSuggestionItem[];
  onManualPromptSubmit?: (userPrompt: string) => void;
};

export const AIMenu = (props: AIMenuProps) => {
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const [prompt, setPrompt] = useState('');
  const { t } = useTranslation();
  // BlockNote's AIExtension makes the editor non-editable as soon as the AI
  // menu opens (openAIMenuAtBlock), and the real selection is gone by the
  // time the user has typed a prompt and submitted it -- only a decorative
  // highlight remains, editor.getSelectedText() returns "" by then (verified
  // live: logging it at submit time vs. at this component's first render
  // showed the real text only survives up to mount). Capture it once here,
  // via a lazy initializer so it runs exactly once when this component
  // mounts (i.e. every time the menu opens, since it unmounts on close).
  const [selectionContext] = useState<string | null>(() => {
    const selectedText = editor.getSelectedText();
    return selectedText ? describeSelection(editor, selectedText) : null;
  });

  const Components = useComponentsContext();

  const ai = useExtension(AIExtension);

  const aiResponseStatus = useExtensionState(AIExtension, {
    selector: (state) =>
      state.aiMenuState !== 'closed' ? state.aiMenuState.status : 'closed',
  });
  // Only meaningful when aiResponseStatus === 'error'; xl-ai types it `any`,
  // narrowed below via `instanceof Error` instead of trusting that.
  const aiError: unknown = useExtensionState(AIExtension, {
    selector: (state) =>
      state.aiMenuState !== 'closed' && state.aiMenuState.status === 'error'
        ? (state.aiMenuState.error as unknown)
        : undefined,
  });
  // documents/{id}/ai-proxy/ throttles requests (settings.AI_USER_RATE_THROTTLE_RATES
  // / AI_DOCUMENT_RATE_THROTTLE_RATES) and returns DRF's default 429 body —
  // `{"detail": "Request was throttled. Expected available in N seconds."}` — which
  // the `ai` package turns into `new Error(<that body text>)`. Detecting it lets the
  // menu tell the user it's a rate limit instead of a generic failure.
  const isRateLimited =
    aiError instanceof Error && /throttled/i.test(aiError.message);
  // xl-ai's own client (filterNewOrUpdatedOperations.ts) throws a plain
  // `Error("No operations seen")` when the model's applyDocumentOperations
  // call carries no operations at all -- a legitimate "nothing to change"
  // answer, not a real failure. That plain Error isn't a `ChunkExecutionError`,
  // so xl-ai's own catch-all (chatHandlers.ts) can't attribute it to a chunk
  // and rethrows it as this generic, differently-worded message instead --
  // verified live against the actual `aiMenuState.error.message` (matching
  // "No operations seen" itself never fires). It's a gap in that library we
  // can't patch, so at least tell the user plainly instead of "An error
  // occurred...".
  const isNoOperationsError =
    aiError instanceof Error && /no chunkexecutionerror/i.test(aiError.message);

  const { items: externalItems } = props;
  // note, technically there might be a bug with this useMemo when quickly changing the selection and opening the menu
  // would not call getDefaultAIMenuItems with the correct selection, because the component is reused and the memo not retriggered
  // practically this should not happen (you can test it by using a high transition duration in useUIElementPositioning)
  const items = useMemo(() => {
    let items: AIMenuSuggestionItem[];
    if (externalItems) {
      items = externalItems(editor, aiResponseStatus);
    } else {
      items = getDefaultAIMenuItems(editor, aiResponseStatus);
    }

    /**
     * Customizations to the default AI Menu items
     */
    if (aiResponseStatus === 'user-input') {
      if (editor.getSelection()) {
        items = items
          .filter((item) => ['simplify'].indexOf(item.key) === -1)
          .map((item) => {
            if (item.key === 'improve_writing') {
              return {
                ...item,
                icon: <IconWandStar />,
              };
            } else if (item.key === 'translate') {
              return {
                ...item,
                icon: (
                  <Icon iconName="translate" $color="inherit" $size="18px" />
                ),
              };
            }

            return item;
          });
      } else {
        items = items.filter(
          (item) => ['action_items', 'write_anything'].indexOf(item.key) === -1,
        );
      }
    } else if (aiResponseStatus === 'user-reviewing') {
      items = items.map((item) => {
        if (item.key === 'accept') {
          return {
            ...item,
            icon: (
              <Icon iconName="check_circle" $color="inherit" $size="18px" />
            ),
          };
        }
        return item;
      });
    } else if (aiResponseStatus === 'error') {
      items.unshift({
        key: 'accept',
        icon: <Icon iconName="check_circle" $color="inherit" $size="18px" />,
        title: t('Accept anyway'),
        onItemClick: () => {
          ai.acceptChanges();
          ai.closeAIMenu();
        },
        size: 'small',
      });
    }

    // map from AI items to React Items required by PromptSuggestionMenu
    return items.map((item) => {
      return {
        ...item,
        onItemClick: () => {
          item.onItemClick(setPrompt);
        },
      };
    });
  }, [externalItems, aiResponseStatus, editor, t, ai]);

  const onManualPromptSubmitDefault = useCallback(
    async (userPrompt: string) => {
      // `useSelection: true` makes xl-ai cut the selected range into its own
      // block and apply operations only within it, which requires the model to
      // return *just the replacement for the selection* — incompatible with the
      // server prompt (BLOCKNOTE_TOOL_STRICT_PROMPT), which forces whole-block
      // `update` ops (duplicated/garbled content otherwise). Always operate on
      // whole blocks (useSelection: false), but still tell the model which exact
      // text is selected as plain context (captured at mount, see
      // `selectionContext` above), so a prompt like "translate this" can
      // resolve what "this" refers to without changing the response format.
      //
      // The user's own request comes FIRST and the selection facts AFTER, not
      // the other way round: putting "Selected text / Selected block id /
      // ..." ahead of the request made the model read the selection as the
      // primary instruction before it even knew what was being asked, biasing
      // it toward the selection even when the request was clearly about
      // something else. Appending it afterwards, framed as optional context,
      // lets the request set the intent first.
      const promptWithSelection = selectionContext
        ? `${userPrompt}\n\n---\nContext on the editor's current selection -- only relevant if the request above refers to it (e.g. "this", "that", "it"); otherwise ignore it:\n${selectionContext}`
        : userPrompt;
      await ai.invokeAI({
        userPrompt: promptWithSelection,
        useSelection: false,
      });
    },
    [ai, selectionContext],
  );

  useEffect(() => {
    // this is a bit hacky to run a useeffect to reset the prompt when the AI response is done
    if (
      aiResponseStatus === 'ai-writing' ||
      aiResponseStatus === 'thinking' ||
      aiResponseStatus === 'user-reviewing' ||
      aiResponseStatus === 'error'
    ) {
      setPrompt('');
    }
  }, [aiResponseStatus]);

  const placeholder = useMemo(() => {
    if (aiResponseStatus === 'thinking') {
      return t('Thinking...');
    } else if (aiResponseStatus === 'ai-writing') {
      return t('Writing...');
    } else if (aiResponseStatus === 'error') {
      if (isRateLimited) {
        return t('Too many requests. Please wait a moment and try again.');
      }
      if (isNoOperationsError) {
        return t(
          "The AI didn't find anything to change. Try rephrasing your request.",
        );
      }
      return t('An error occurred...');
    }

    return t('Ask anything...');
  }, [aiResponseStatus, isRateLimited, isNoOperationsError, t]);

  const ariaLiveMessage = useMemo(() => {
    if (aiResponseStatus === 'thinking') {
      return t('AI is thinking');
    }
    if (aiResponseStatus === 'ai-writing') {
      return t('AI is writing');
    }
    if (aiResponseStatus === 'user-reviewing') {
      return t('AI response ready for review');
    }
    if (aiResponseStatus === 'error') {
      if (isRateLimited) {
        return t('Too many requests. Please wait a moment and try again.');
      }
      if (isNoOperationsError) {
        return t(
          "The AI didn't find anything to change. Try rephrasing your request.",
        );
      }
      return t('AI request failed');
    }

    return '';
  }, [aiResponseStatus, isRateLimited, isNoOperationsError, t]);

  const ariaLiveMode = aiResponseStatus === 'error' ? 'assertive' : 'polite';

  const IconInput = useMemo(() => {
    if (aiResponseStatus === 'thinking') {
      return <IconAI width="24px" isLoading />;
    } else if (aiResponseStatus === 'ai-writing') {
      return <IconAI width="24px" isHighlighted />;
    } else if (aiResponseStatus === 'error') {
      return <IconAI width="23px" isError />;
    }

    return <IconAI width="24px" />;
  }, [aiResponseStatus]);

  const rightSection = useMemo(() => {
    if (aiResponseStatus === 'thinking' || aiResponseStatus === 'ai-writing') {
      if (!Components) {
        return null;
      }

      return (
        <Button
          onClick={async () => {
            await ai.abort();
            ai.rejectChanges();
            ai.closeAIMenu();
          }}
          size="small"
          variant="secondary"
          icon={
            <Icon
              $size="lg"
              $withThemeInherited
              iconName="stop"
              variant="filled"
            />
          }
        >
          {t('Stop')}
        </Button>
      );
    }

    return undefined;
  }, [Components, ai, aiResponseStatus, t]);

  useEffect(() => {
    const handleEscape = async (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        await ai.abort();
        ai.rejectChanges();
        ai.closeAIMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [ai]);

  return (
    <Box className="--docs--ai-menu" $width="100%" $maxWidth="500px">
      <AIMenuStyle />
      <span className="sr-only" aria-live={ariaLiveMode} aria-atomic="true">
        {ariaLiveMessage}
      </span>
      <PromptSuggestionMenu
        onManualPromptSubmit={
          props.onManualPromptSubmit || onManualPromptSubmitDefault
        }
        items={items}
        promptText={prompt}
        onPromptTextChange={setPrompt}
        placeholder={placeholder}
        disabled={
          aiResponseStatus === 'thinking' || aiResponseStatus === 'ai-writing'
        }
        icon={IconInput}
        rightSection={rightSection}
      />
    </Box>
  );
};
