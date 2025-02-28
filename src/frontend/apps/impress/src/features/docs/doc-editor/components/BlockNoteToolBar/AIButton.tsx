import {
  ComponentProps,
  useBlockNoteEditor,
  useComponentsContext,
  useSelectedBlocks,
} from '@blocknote/react';
import {
  Loader,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { PropsWithChildren, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isAPIError } from '@/api';
import { Box, Text } from '@/components';
import { useDocOptions, useDocStore } from '@/features/docs/doc-management/';

import {
  AITransformActions,
  useDocAITransform,
  useDocAITranslate,
} from '../../api';

type LanguageTranslate = {
  value: string;
  display_name: string;
};

const sortByPopularLanguages = (
  languages: LanguageTranslate[],
  popularLanguages: string[],
) => {
  languages.sort((a, b) => {
    const indexA = popularLanguages.indexOf(a.value);
    const indexB = popularLanguages.indexOf(b.value);

    // If both languages are in the popular list, sort based on their order in popularLanguages
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only a is in the popular list, it should come first
    if (indexA !== -1) {
      return -1;
    }

    // If only b is in the popular list, it should come first
    if (indexB !== -1) {
      return 1;
    }

    // If neither a nor b is in the popular list, maintain their relative order
    return 0;
  });
};

export function AIGroupButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const selectedBlocks = useSelectedBlocks(editor);
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const { data: docOptions } = useDocOptions();

  const languages = useMemo(() => {
    const languages = docOptions?.actions.POST.language.choices;

    if (!languages) {
      return;
    }

    sortByPopularLanguages(languages, [
      'fr',
      'en',
      'de',
      'es',
      'it',
      'pt',
      'nl',
      'pl',
    ]);

    return languages;
  }, [docOptions?.actions.POST.language.choices]);

  const show = useMemo(() => {
    return !!selectedBlocks.find((block) => block.content !== undefined);
  }, [selectedBlocks]);

  if (!show || !editor.isEditable || !Components || !currentDoc || !languages) {
    return null;
  }

  const canAITransform = currentDoc.abilities.ai_transform;
  const canAITranslate = currentDoc.abilities.ai_translate;

  if (!canAITransform && !canAITranslate) {
    return null;
  }

  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button bn-menu-item"
          data-test="ai-actions"
          label="AI"
          mainTooltip={t('AI Actions')}
          icon={
            <Text $isMaterialIcon $size="l">
              auto_awesome
            </Text>
          }
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown
        className="bn-menu-dropdown bn-drag-handle-menu"
        sub={true}
      >
        {canAITransform && (
          <>
            <AIMenuItemTransform
              action="prompt"
              docId={currentDoc.id}
              icon={
                <Text $isMaterialIcon $size="s">
                  text_fields
                </Text>
              }
            >
              {t('Use as prompt')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="rephrase"
              docId={currentDoc.id}
              icon={
                <Text $isMaterialIcon $size="s">
                  refresh
                </Text>
              }
            >
              {t('Rephrase')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="summarize"
              docId={currentDoc.id}
              icon={
                <Text $isMaterialIcon $size="s">
                  summarize
                </Text>
              }
            >
              {t('Summarize')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="correct"
              docId={currentDoc.id}
              icon={
                <Text $isMaterialIcon $size="s">
                  check
                </Text>
              }
            >
              {t('Correct')}
            </AIMenuItemTransform>
          </>
        )}
        {canAITranslate && (
          <Components.Generic.Menu.Root position="right" sub={true}>
            <Components.Generic.Menu.Trigger sub={false}>
              <Components.Generic.Menu.Item
                className="bn-menu-item"
                subTrigger={true}
              >
                <Box $direction="row" $gap="0.6rem">
                  <Text $isMaterialIcon $size="s">
                    translate
                  </Text>
                  {t('Language')}
                </Box>
              </Components.Generic.Menu.Item>
            </Components.Generic.Menu.Trigger>
            <Components.Generic.Menu.Dropdown
              sub={true}
              className="bn-menu-dropdown"
            >
              {languages.map((language) => (
                <AIMenuItemTranslate
                  key={language.value}
                  language={language.value}
                  docId={currentDoc.id}
                >
                  {language.display_name}
                </AIMenuItemTranslate>
              ))}
            </Components.Generic.Menu.Dropdown>
          </Components.Generic.Menu.Root>
        )}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

/**
 * Item is derived from Mantime, some props seem lacking or incorrect.
 */
type ItemDefault = ComponentProps['Generic']['Menu']['Item'];
type ItemProps = Omit<ItemDefault, 'onClick'> & {
  rightSection?: ReactNode;
  closeMenuOnClick?: boolean;
  onClick: (e: React.MouseEvent) => void;
};

interface AIMenuItemTransform {
  action: AITransformActions;
  docId: string;
  icon?: ReactNode;
}

const AIMenuItemTransform = ({
  docId,
  action,
  children,
  icon,
}: PropsWithChildren<AIMenuItemTransform>) => {
  const { mutateAsync: requestAI, isPending } = useDocAITransform();

  const requestAIAction = async (markdown: string) => {
    const responseAI = await requestAI({
      text: markdown,
      action,
      docId,
    });
    return responseAI.answer;
  };

  return (
    <AIMenuItem icon={icon} requestAI={requestAIAction} isPending={isPending}>
      {children}
    </AIMenuItem>
  );
};

interface AIMenuItemTranslate {
  language: string;
  docId: string;
  icon?: ReactNode;
}

const AIMenuItemTranslate = ({
  children,
  docId,
  icon,
  language,
}: PropsWithChildren<AIMenuItemTranslate>) => {
  const { mutateAsync: requestAI, isPending } = useDocAITranslate();

  const requestAITranslate = async (markdown: string) => {
    const responseAI = await requestAI({
      text: markdown,
      language,
      docId,
    });
    return responseAI.answer;
  };

  return (
    <AIMenuItem
      icon={icon}
      requestAI={requestAITranslate}
      isPending={isPending}
    >
      {children}
    </AIMenuItem>
  );
};

interface AIMenuItemProps {
  requestAI: (markdown: string) => Promise<string>;
  isPending: boolean;
  icon?: ReactNode;
}

const AIMenuItem = ({
  requestAI,
  isPending,
  children,
  icon,
}: PropsWithChildren<AIMenuItemProps>) => {
  const Components = useComponentsContext();

  const editor = useBlockNoteEditor();
  const handleAIError = useHandleAIError();

  const handleAIAction = async () => {
    let selectedBlocks = editor.getSelection()?.blocks;

    if (!selectedBlocks || selectedBlocks.length === 0) {
      selectedBlocks = [editor.getTextCursorPosition().block];

      if (!selectedBlocks || selectedBlocks.length === 0) {
        return;
      }
    }

    const markdown = await editor.blocksToMarkdownLossy(selectedBlocks);

    try {
      const responseAI = await requestAI(markdown);

      if (!responseAI) {
        return;
      }

      const blockMarkdown = await editor.tryParseMarkdownToBlocks(responseAI);
      editor.replaceBlocks(selectedBlocks, blockMarkdown);
    } catch (error) {
      handleAIError(error);
    }
  };

  if (!Components) {
    return null;
  }

  const Item = Components.Generic.Menu.Item as React.FC<ItemProps>;

  return (
    <Item
      closeMenuOnClick={false}
      icon={icon}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        void handleAIAction();
      }}
      rightSection={isPending ? <Loader size="small" /> : undefined}
    >
      {children}
    </Item>
  );
};

const useHandleAIError = () => {
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return (error: unknown) => {
    if (isAPIError(error) && error.status === 429) {
      toast(t('Too many requests. Please wait 60 seconds.'), VariantType.ERROR);
      return;
    }

    toast(t('AI seems busy! Please try again.'), VariantType.ERROR);
  };
};
