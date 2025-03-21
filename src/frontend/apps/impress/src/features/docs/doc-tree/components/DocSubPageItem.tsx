import { TreeViewItem, TreeViewNodeProps } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/features/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';

import { useDocTreeData } from '../context/DocTreeContext';

import Logo from './../assets/sub-page-logo.svg';
import { DocTreeItemActions } from './DocTreeItemActions';

const ItemTextCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: initial;
  display: -webkit-box;
  line-clamp: 1;
  /* width: 100%; */
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`;

type Props = TreeViewNodeProps<Doc> & {
  doc: Doc;
  setSelectedNode: (node: Doc) => void;
};

export const DocSubPageItem = ({ doc, setSelectedNode, ...props }: Props) => {
  const { loadChildren, node } = props;

  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();
  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();
  const treeData = useDocTreeData();

  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0 && loadChildren) {
      loadChildren(node?.data.value)
        .then((allChildren) => {
          node.open();

          router.push(`/docs/${doc.id}`);
          treeData?.tree.setChildren(node.data.value.id, allChildren);
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
      treeData?.tree.addChild(node.data.value.id, newDoc);
      node.open();
      router.push(`/docs/${createdDoc.id}`);
      togglePanel();
    }
  };

  if (!treeData) {
    return null;
  }

  return (
    <TreeViewItem
      {...props}
      loadChildren={() =>
        treeData?.tree.handleLoadChildren(props.node.data.value.id)
      }
      onClick={() => {
        setSelectedNode(props.node.data.value as Doc);
        router.push(`/docs/${props.node.data.value.id}`);
      }}
    >
      <Box
        data-testid={`doc-sub-page-item-${props.node.data.value.id}`}
        $width="100%"
        $direction="row"
        $gap={spacing['xs']}
        role="button"
        tabIndex={0}
        $align="center"
        $css={css`
          .light-doc-item-actions {
            display: 'flex';
            opacity: 0;

            &:has(.isOpen) {
              opacity: 1;
            }
          }
          &:hover {
            .light-doc-item-actions {
              opacity: 1;
            }
          }
        `}
      >
        <Box $width={16} $height={16}>
          <Logo />
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
          <Text $css={ItemTextCss} $size="sm">
            {doc.title}
          </Text>
          {doc.nb_accesses_direct > 1 && (
            <Icon isFilled iconName="group" $size="16px" $variation="400" />
          )}
        </Box>

        <Box
          $direction="row"
          $gap={spacing['xs']}
          $align="center"
          className="light-doc-item-actions"
        >
          <DocTreeItemActions
            doc={doc}
            parentId={node.data.parentKey}
            onCreateSuccess={afterCreate}
          />
        </Box>
      </Box>
    </TreeViewItem>
  );
};
