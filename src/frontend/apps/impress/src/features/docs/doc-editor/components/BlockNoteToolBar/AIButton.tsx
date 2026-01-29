import { Block } from '@blocknote/core';
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
} from '@gouvfr-lasuite/cunningham-react';
import { PropsWithChildren, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isAPIError } from '@/api';
import { Box, Icon } from '@/components';
import { useDocOptions, useDocStore } from '@/docs/doc-management/';

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
          className="bn-button bn-menu-item --docs--ai-actions-menu-trigger"
          data-test="ai-actions"
          label="AI"
          mainTooltip={t('AI Actions')}
          icon={<Icon iconName="auto_awesome" $size="md" />}
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown
        className="bn-menu-dropdown bn-drag-handle-menu --docs--ai-actions-menu"
        sub={true}
      >
        {canAITransform && (
          <>
            <AIMenuItemTransform
              action="prompt"
              docId={currentDoc.id}
              icon={<Icon iconName="text_fields" $size="s" />}
            >
              {t('Use as prompt')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="rephrase"
              docId={currentDoc.id}
              icon={<Icon iconName="refresh" $size="s" />}
            >
              {t('Rephrase')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="summarize"
              docId={currentDoc.id}
              icon={<Icon iconName="summarize" $size="s" />}
            >
              {t('Summarize')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="correct"
              docId={currentDoc.id}
              icon={<Icon iconName="check" $size="s" />}
            >
              {t('Correct')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="beautify"
              docId={currentDoc.id}
              icon={<Icon iconName="draw" $size="s" />}
            >
              {t('Beautify')}
            </AIMenuItemTransform>
            <AIMenuItemTransform
              action="emojify"
              docId={currentDoc.id}
              icon={<Icon iconName="emoji_emotions" $size="s" />}
            >
              {t('Emojify')}
            </AIMenuItemTransform>
          </>
        )}
        {canAITranslate && (
          <Components.Generic.Menu.Root position="right" sub={true}>
            <Components.Generic.Menu.Trigger sub={false}>
              <Components.Generic.Menu.Item
                className="bn-menu-item --docs--ai-translate-menu-trigger"
                subTrigger={true}
              >
                <Box $direction="row" $gap="0.6rem">
                  <Icon iconName="translate" $size="s" />
                  {t('Language')}
                </Box>
              </Components.Generic.Menu.Item>
            </Components.Generic.Menu.Trigger>
            <Components.Generic.Menu.Dropdown
              sub={true}
              className="bn-menu-dropdown --docs--ai-translate-menu"
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

interface AIMenuItemTransformProps {
  action: AITransformActions;
  docId: string;
  icon?: ReactNode;
}

const AIMenuItemTransform = ({
  docId,
  action,
  children,
  icon,
}: PropsWithChildren<AIMenuItemTransformProps>) => {
  const { mutateAsync: requestAI, isPending } = useDocAITransform();
  const editor = useBlockNoteEditor();

  const requestAIAction = async (selectedBlocks: Block[]) => {
    const text = await editor.blocksToMarkdownLossy(selectedBlocks);

    const responseAI = await requestAI({
      text,
      action,
      docId,
    });

    if (!responseAI?.answer) {
      throw new Error('No response from AI');
    }

    const markdown = await editor.tryParseMarkdownToBlocks(responseAI.answer);
    editor.replaceBlocks(selectedBlocks, markdown);
  };

  return (
    <AIMenuItem icon={icon} requestAI={requestAIAction} isPending={isPending}>
      {children}
    </AIMenuItem>
  );
};

interface AIMenuItemTranslateProps {
  language: string;
  docId: string;
  icon?: ReactNode;
}

const AIMenuItemTranslate = ({
  children,
  docId,
  icon,
  language,
}: PropsWithChildren<AIMenuItemTranslateProps>) => {
  const { mutateAsync: requestAI, isPending } = useDocAITranslate();
  const editor = useBlockNoteEditor();

  const requestAITranslate = async (selectedBlocks: Block[]) => {
    let fullHtml = '';
    for (const block of selectedBlocks) {
      if (Array.isArray(block.content) && block.content.length === 0) {
        fullHtml += '<p><br/></p>';
        continue;
      }

      fullHtml += await editor.blocksToHTMLLossy([block]);
    }

    const responseAI = await requestAI({
      text: fullHtml,
      language,
      docId,
    });

    if (!responseAI || !responseAI.answer) {
      throw new Error('No response from AI');
    }

    try {
      const blocks = await editor.tryParseHTMLToBlocks(responseAI.answer);
      editor.replaceBlocks(selectedBlocks, blocks);
    } catch {
      editor.replaceBlocks(selectedBlocks, selectedBlocks);
    }
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
  requestAI: (blocks: Block[]) => Promise<void>;
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
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  const editor = useBlockNoteEditor();
  const handleAIError = useHandleAIError();

  const handleAIAction = async () => {
    const selectedBlocks = editor.getSelection()?.blocks ?? [
      editor.getTextCursorPosition().block,
    ];

    if (!selectedBlocks?.length) {
      toast(t('No text selected'), VariantType.WARNING);
      return;
    }

    try {
      await requestAI(selectedBlocks);
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
