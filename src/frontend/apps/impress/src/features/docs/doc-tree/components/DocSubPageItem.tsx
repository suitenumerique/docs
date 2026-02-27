import {
  TreeViewDataType,
  TreeViewItem,
  TreeViewNodeProps,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  DocIcon,
  getEmojiAndTitle,
  useTrans,
} from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import SubPageIcon from './../assets/sub-page-logo.svg';
import { DocTreeItemActions } from './DocTreeItemActions';

const ItemTextCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: initial;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`;

export const DocSubPageItem = (props: TreeViewNodeProps<Doc>) => {
  const doc = props.node.data.value as Doc;
  const treeContext = useTreeContext<Doc>();
  const { untitledDocument } = useTrans();
  const { node } = props;
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();

  const [menuOpen, setMenuOpen] = useState(false);
  const isSelectedNow = treeContext?.treeData.selectedNode?.id === doc.id;

  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title || '');
  const displayTitle = titleWithoutEmoji || untitledDocument;

  const handleActivate = () => {
    treeContext?.treeData.setSelectedNode(doc);
    router.push(`/docs/${doc.id}`);
  };

  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0) {
      treeContext?.treeData
        .handleLoadChildren(node?.data.value.id)
        .then((allChildren) => {
          node.open();

          router.push(`/docs/${createdDoc.id}`);
          treeContext?.treeData.setChildren(
            node.data.value.id,
            allChildren as TreeViewDataType<Doc>[],
          );
          treeContext?.treeData.setSelectedNode(createdDoc);
          togglePanel();
        })
        .catch(console.error);
    } else {
      const newDoc = {
        ...createdDoc,
        children: [],
        childrenCount: 0,
        parentId: node.id,
      };
      treeContext?.treeData.addChild(node.data.value.id, newDoc);
      node.open();
      router.push(`/docs/${createdDoc.id}`);
      treeContext?.treeData.setSelectedNode(newDoc);
      togglePanel();
    }
  };

  const docTitle = doc.title || untitledDocument;
  const hasChildren = (doc.children?.length || 0) > 0;
  const isExpanded = node.isOpen;
  const isSelected = isSelectedNow;
  const ariaLabel = docTitle;
  const isDisabled = !!doc.deleted_at;
  const actionsRef = useRef<HTMLDivElement>(null);
  const buttonOptionRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isInActions = !!target?.closest('.light-doc-item-actions');
    const isOnEmojiButton = !!target?.closest('.--docs--doc-icon');

    // F2: focus first action button
    const shouldOpenActions =
      !menuOpen && !isInActions && (node.isFocused || isOnEmojiButton);
    if (e.key === 'F2' && shouldOpenActions) {
      buttonOptionRef.current?.focus();
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  };

  const handleActionsOpenChange = (isOpen: boolean) => {
    setMenuOpen(isOpen);

    // When the menu closes (via Escape or activating an option),
    // return focus to the tree item so focus is not lost.
    if (!isOpen) {
      node.focus();
    }
  };

  return (
    <Box
      className="--docs-sub-page-item"
      draggable={doc.abilities.move && isDesktop}
      $position="relative"
      role="treeitem"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-disabled={isDisabled}
      onKeyDown={handleKeyDown}
      $css={css`
        background-color: var(--c--globals--colors--gray-000);
        .light-doc-item-actions {
          display: ${menuOpen || !isDesktop ? 'flex' : 'none'};
          right: var(--c--globals--spacings--0);
        }
        .c__tree-view--node.isFocused {
          outline: none !important;
          box-shadow: 0 0 0 2px var(--c--globals--colors--brand-500) !important;
          border-radius: var(--c--globals--spacings--st);
          .light-doc-item-actions {
            display: flex;
          }
        }
        /* Remove visual focus from the tree item when focus is on actions or emoji button */
        &:has(.light-doc-item-actions *:focus, .--docs--doc-icon:focus-visible)
          .c__tree-view--node.isFocused {
          box-shadow: none !important;
        }
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--gray--tertiary
          );
          border-radius: var(--c--globals--spacings--st);
          .light-doc-item-actions {
            display: flex;
          }
        }
        &:focus-within {
          .light-doc-item-actions {
            display: flex;
          }
        }
        .row.preview & {
          background-color: inherit;
        }
      `}
    >
      <TreeViewItem {...props} onClick={handleActivate}>
        <DocIcon
          emoji={emoji}
          withEmojiPicker={doc.abilities.partial_update}
          defaultIcon={
            <SubPageIcon
              color="var(--c--contextuals--content--semantic--info--tertiary)"
              style={{ flexShrink: 0 }}
            />
          }
          $size="sm"
          docId={doc.id}
          title={doc.title}
          buttonProps={{
            $css: css`
              &:focus-visible {
                outline: 2px solid var(--c--globals--colors--brand-500);
                outline-offset: var(--c--globals--spacings--4xs);
              }
            `,
          }}
        />
        <Box
          $direction="row"
          $align="center"
          className="light-doc-item-actions actions"
          role="toolbar"
          aria-label={`${t('Actions for {{title}}', { title: docTitle })}`}
          $css={css`
            margin-left: auto;
            order: 2;
          `}
        >
          <DocTreeItemActions
            doc={doc}
            isOpen={menuOpen}
            onOpenChange={handleActionsOpenChange}
            parentId={node.data.parentKey}
            onCreateSuccess={afterCreate}
            actionsRef={actionsRef}
            buttonOptionRef={buttonOptionRef}
          />
        </Box>
        <BoxButton
          onClick={(e) => {
            e.stopPropagation();
            handleActivate();
          }}
          $width="100%"
          $direction="row"
          $gap={spacingsTokens['xs']}
          $align="center"
          $minHeight="24px"
          data-testid={`doc-sub-page-item-${doc.id}`}
          aria-label={`${t('Open document {{title}}', { title: docTitle })}`}
          $css={css`
            text-align: left;
            min-width: 0;
          `}
        >
          <Box
            $direction="row"
            $align="center"
            $css={css`
              display: flex;
              flex-direction: row;
              width: 100%;
              min-width: 0;
              gap: 0.5rem;
              align-items: center;
              overflow: hidden;
            `}
          >
            <Text $css={ItemTextCss} $size="sm">
              {displayTitle}
            </Text>
            {doc.nb_accesses_direct >= 1 && (
              <Icon
                variant="filled"
                iconName="group"
                $size="md"
                aria-hidden="true"
              />
            )}
          </Box>
        </BoxButton>
      </TreeViewItem>
    </Box>
  );
};
