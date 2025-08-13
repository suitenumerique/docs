import {
  TreeViewItem,
  TreeViewNodeProps,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  getEmojiAndTitle,
  useTrans,
} from '@/features/docs/doc-management';
import { DocIcon } from '@/features/docs/doc-management/components/DocIcon';
import { useActionableMode } from '@/features/docs/doc-tree/hooks/useActionableMode';
import { useLoadChildrenOnOpen } from '@/features/docs/doc-tree/hooks/useLoadChildrenOnOpen';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import { useKeyboardActivation } from '../hooks/useKeyboardActivation';

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
  const isActive = node.isFocused || menuOpen || isSelectedNow;

  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title || '');
  const displayTitle = titleWithoutEmoji || untitledDocument;

  const handleActivate = () => {
    treeContext?.treeData.setSelectedNode(doc);
    router.push(`/docs/${doc.id}`);
  };
  const { actionsRef, onKeyDownCapture } = useActionableMode(node, menuOpen);
  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0) {
      treeContext?.treeData
        .handleLoadChildren(node?.data.value.id)
        .then((allChildren) => {
          node.open();

          router.push(`/docs/${createdDoc.id}`);
          treeContext?.treeData.setChildren(node.data.value.id, allChildren);
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

  useKeyboardActivation(
    ['Enter', ' '],
    isActive && !menuOpen,
    handleActivate,
    true,
  );
  useLoadChildrenOnOpen(
    node.data.value.id,
    node.isOpen,
    treeContext?.treeData.handleLoadChildren,
    treeContext?.treeData.setChildren,
    (doc.children?.length ?? 0) > 0 || doc.childrenCount === 0,
  );

  // prepare the text for the screen reader
  const docTitle = doc.title || untitledDocument;
  const hasChildren = (doc.children?.length || 0) > 0;
  const isExpanded = node.isOpen;
  const isSelected = isSelectedNow;

  const ariaLabel = `${docTitle}${hasChildren ? `, ${isExpanded ? t('expanded') : t('collapsed')}` : ''}${isSelected ? `, ${t('selected')}` : ''}`;

  return (
    <Box
      className="--docs-sub-page-item"
      draggable={doc.abilities.move && isDesktop}
      $position="relative"
      role="treeitem"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      $css={css`
        /* Ensure the outline (handled by TreeView) matches the visual area */
        .c__tree-view--node {
          padding: ${spacingsTokens['3xs']};
          border-radius: 4px;
        }

        .light-doc-item-actions {
          display: flex;
          opacity: ${isActive || !isDesktop ? 1 : 0};
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          z-index: 10;
        }

        .c__tree-view--node:hover,
        .c__tree-view--node.isFocused {
          background-color: var(--c--theme--colors--greyscale-100);

          .light-doc-item-actions {
            display: flex;
            opacity: 1;
            visibility: visible;
            /* background: var(--c--theme--colors--greyscale-100); */
          }
        }

        .row.preview & {
          background-color: inherit;
        }

        /* Ensure actions are visible when hovering the whole item container */
        &:hover {
          .light-doc-item-actions {
            display: flex;
            opacity: 1;
            visibility: visible;
          }
        }
      `}
    >
      <TreeViewItem {...props} onClick={handleActivate}>
        <BoxButton
          onClick={(e) => {
            e.stopPropagation();
            handleActivate();
          }}
          tabIndex={-1}
          $width="100%"
          $direction="row"
          $gap={spacingsTokens['xs']}
          $align="center"
          $minHeight="24px"
          data-testid={`doc-sub-page-item-${doc.id}`}
          aria-label={`${t('Open document')} ${docTitle}`}
        >
          <Box $width="16px" $height="16px">
            <DocIcon emoji={emoji} defaultIcon={<SubPageIcon />} $size="sm" />
          </Box>

          <Box
            $direction="row"
            $align="center"
            $css={css`
              display: flex;
              flex-direction: row;
              width: 100%;
              gap: 0.5rem;
              align-items: center;
            `}
          >
            <Text $css={ItemTextCss} $size="sm" $variation="1000">
              {displayTitle}
            </Text>
            {doc.nb_accesses_direct >= 1 && (
              <Icon
                variant="filled"
                iconName="group"
                $size="16px"
                $variation="400"
                aria-hidden="true"
              />
            )}
          </Box>
        </BoxButton>
      </TreeViewItem>

      <Box
        ref={actionsRef}
        onKeyDownCapture={onKeyDownCapture}
        $direction="row"
        $align="center"
        className="light-doc-item-actions"
        role="group"
        aria-label={`${t('Actions for')} ${docTitle}`}
      >
        <DocTreeItemActions
          doc={doc}
          isOpen={menuOpen}
          onOpenChange={setMenuOpen}
          parentId={node.data.parentKey}
          onCreateSuccess={afterCreate}
        />
      </Box>
    </Box>
  );
};
