import {
  TreeViewItem,
  TreeViewNodeProps,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useActionableMode } from '@/components/dropdown-menu/hook/useActionableMode';
import { useTreeItemKeyboardActivate } from '@/components/dropdown-menu/hook/useTreeItemKeyboardActivate';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  getEmojiAndTitle,
  useTrans,
} from '@/features/docs/doc-management';
import { DocIcon } from '@/features/docs/doc-management/components/DocIcon';
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

  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = node.isFocused || menuOpen;

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

  useTreeItemKeyboardActivate(isActive, handleActivate);

  return (
    <Box
      className="--docs-sub-page-item"
      draggable={doc.abilities.move && isDesktop}
      $position="relative"
      $css={css`
        background-color: ${isActive
          ? 'var(--c--theme--colors--greyscale-100)'
          : 'var(--c--theme--colors--greyscale-000)'};

        .light-doc-item-actions {
          display: flex;
          opacity: ${isActive || !isDesktop ? 1 : 0};
          visibility: ${isActive || !isDesktop ? 'visible' : 'hidden'};
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          background: ${isDesktop
            ? 'var(--c--theme--colors--greyscale-100)'
            : 'var(--c--theme--colors--greyscale-000)'};
          z-index: 10;
        }

        &:focus-within .light-doc-item-actions {
          display: flex;
          background: var(--c--theme--colors--greyscale-100);
        }

        .c__tree-view--node.isSelected {
          .light-doc-item-actions {
            background: var(--c--theme--colors--greyscale-100);
          }
        }

        &:hover,
        &:focus-within {
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
          as="button"
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
