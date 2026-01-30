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
import { Button } from '@gouvfr-lasuite/cunningham-react';
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
  .--docs--ai-menu input[name="ai-prompt"]{
    padding-inline-start: 3rem;
  }
  .--docs--ai-menu .mantine-TextInput-section[data-position="left"] {
    margin-inline: 0.75rem;
  }
  .--docs--ai-menu .mantine-TextInput-section[data-position="right"] {
    inset-inline-end: 2rem;
  }
`;

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

  const Components = useComponentsContext();

  const ai = useExtension(AIExtension);

  const aiResponseStatus = useExtensionState(AIExtension, {
    selector: (state) =>
      state.aiMenuState !== 'closed' ? state.aiMenuState.status : 'closed',
  });

  const { items: externalItems } = props;
  // note, technically there might be a bug with this useMemo when quickly changing the selection and opening the menu
  // would not call getDefaultAIMenuItems with the correct selection, because the component is reused and the memo not retriggered
  // practically this should not happen (you can test it by using a high transition duration in useUIElementPositioning)
  const items = useMemo(() => {
    let items: AIMenuSuggestionItem[] = [];
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
        items = items.filter((item) => ['simplify'].indexOf(item.key) === -1);
        items = items.map((item) => {
          if (item.key === 'improve_writing') {
            return {
              ...item,
              icon: <IconWandStar />,
            };
          } else if (item.key === 'translate') {
            return {
              ...item,
              icon: <Icon iconName="translate" $color="inherit" $size="18px" />,
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
  }, [externalItems, aiResponseStatus, editor]);

  const onManualPromptSubmitDefault = useCallback(
    async (userPrompt: string) => {
      await ai.invokeAI({
        userPrompt,
        useSelection: editor.getSelection() !== undefined,
      });
    },
    [ai, editor],
  );

  useEffect(() => {
    // this is a bit hacky to run a useeffect to reset the prompt when the AI response is done
    if (
      aiResponseStatus === 'ai-writing' ||
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
      return t('An error occurred...');
    }

    return t('Ask anything...');
  }, [aiResponseStatus, t]);

  const IconInput = useMemo(() => {
    if (aiResponseStatus === 'thinking') {
      return <IconAI width="24px" isHighlighted />;
    } else if (aiResponseStatus === 'ai-writing') {
      return <IconAI width="24px" isHighlighted />;
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
    } else if (aiResponseStatus === 'error') {
      return (
        <div className="bn-combobox-right-section bn-combobox-error">
          {/* Taken from Google Material Icons */}
          {/* https://fonts.google.com/icons?selected=Material+Symbols+Rounded:error:FILL@0;wght@400;GRAD@0;opsz@24&icon.query=error&icon.size=24&icon.color=%23e8eaed&icon.set=Material+Symbols&icon.style=Rounded&icon.platform=web */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="1em"
            viewBox="0 -960 960 960"
            width="1em"
            fill="currentColor"
          >
            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
          </svg>
        </div>
      );
    }

    return undefined;
  }, [Components, aiResponseStatus, t]);

  return (
    <Box className="--docs--ai-menu" $width="100%">
      <AIMenuStyle />
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
