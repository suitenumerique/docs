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
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import { useKeyboardActivation } from '../hooks/useKeyboardActivation';
import { useLoadChildrenOnOpen } from '../hooks/useLoadChildrenOnOpen';

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
    ['Enter'],
    isActive && !menuOpen,
    handleActivate,
    true,
    '.c__tree-view',
  );

  useLoadChildrenOnOpen(
    node.data.value.id,
    node.isOpen,
    treeContext?.treeData.handleLoadChildren,
    treeContext?.treeData.setChildren,
    (doc.children?.length ?? 0) > 0 || doc.childrenCount === 0,
  );

  const docTitle = doc.title || untitledDocument;
  const hasChildren = (doc.children?.length || 0) > 0;
  const isExpanded = node.isOpen;
  const isSelected = isSelectedNow;
  const ariaLabel = docTitle;

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
        background-color: ${menuOpen
          ? 'var(--c--theme--colors--greyscale-100)'
          : 'var(--c--theme--colors--greyscale-000)'};
        .light-doc-item-actions {
          display: ${menuOpen || !isDesktop ? 'flex' : 'none'};
          position: absolute;
          right: 0;
          background: ${isDesktop
            ? 'var(--c--theme--colors--greyscale-100)'
            : 'var(--c--theme--colors--greyscale-000)'};
        }
        .c__tree-view--node.isSelected {
          .light-doc-item-actions {
            background: var(--c--theme--colors--greyscale-100);
          }
        }
        .c__tree-view--node.isFocused {
          outline: none !important;
          box-shadow: 0 0 0 2px var(--c--theme--colors--primary-500) !important;
          border-radius: 4px;
        }
        &:hover {
          background-color: var(--c--theme--colors--greyscale-100);
          border-radius: 4px;
          .light-doc-item-actions {
            display: flex;
            background: var(--c--theme--colors--greyscale-100);
          }
        }
        .row.preview & {
          background-color: inherit;
        }
      `}
    >
      <TreeViewItem {...props} onClick={handleActivate}>
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
          `}
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
        <Box
          $direction="row"
          $align="center"
          className="light-doc-item-actions"
          role="toolbar"
          aria-label={`${t('Actions for {{title}}', { title: docTitle })}`}
        >
          <DocTreeItemActions
            doc={doc}
            isOpen={menuOpen}
            onOpenChange={setMenuOpen}
            parentId={node.data.parentKey}
            onCreateSuccess={afterCreate}
          />
        </Box>
      </TreeViewItem>
    </Box>
  );
};
