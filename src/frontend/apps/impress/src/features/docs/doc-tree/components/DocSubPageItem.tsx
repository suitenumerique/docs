import {
  TreeViewItem,
  TreeViewNodeProps,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_SUB_PAGE,
  useDoc,
  useTrans,
} from '@/features/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';

import Logo from './../assets/sub-page-logo.svg';
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

type Props = TreeViewNodeProps<Doc>;
export const DocSubPageItem = (props: Props) => {
  const doc = props.node.data.value as Doc;
  const treeContext = useTreeContext<Doc>();
  const { untitledDocument } = useTrans();
  const { node } = props;
  const { spacingsTokens } = useCunninghamTheme();
  const [isHover, setIsHover] = useState(false);

  const spacing = spacingsTokens();
  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();

  const isInitialLoad = useRef(false);
  const { data: docQuery } = useDoc(
    { id: doc.id },
    {
      initialData: doc,
      queryKey: [KEY_SUB_PAGE, { id: doc.id }],
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (docQuery && isInitialLoad.current === true) {
      treeContext?.treeData.updateNode(docQuery.id, docQuery);
    }

    if (docQuery) {
      isInitialLoad.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docQuery]);

  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0) {
      treeContext?.treeData
        .handleLoadChildren(node?.data.value.id)
        .then((allChildren) => {
          node.open();

          router.push(`/docs/${doc.id}`);
          treeContext?.treeData.setChildren(node.data.value.id, allChildren);
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
      togglePanel();
    }
  };

  return (
    <Box
      className="--docs-sub-page-item"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      $css={css`
        &:not(:has(.isSelected)):has(.light-doc-item-actions) {
          background-color: var(--c--theme--colors--greyscale-100);
        }
      `}
    >
      <TreeViewItem
        {...props}
        onClick={() => {
          treeContext?.treeData.setSelectedNode(props.node.data.value as Doc);
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
          $minHeight="24px"
        >
          <Box $width="16px" $height="16px">
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
            <Text $css={ItemTextCss} $size="sm" $variation="1000">
              {doc.title || untitledDocument}
            </Text>
            {doc.nb_accesses_direct > 1 && (
              <Icon
                variant="filled"
                iconName="group"
                $size="16px"
                $variation="400"
              />
            )}
          </Box>

          {isHover && (
            <Box
              $direction="row"
              $align="center"
              className="light-doc-item-actions"
            >
              <DocTreeItemActions
                doc={doc}
                parentId={node.data.parentKey}
                onCreateSuccess={afterCreate}
              />
            </Box>
          )}
        </Box>
      </TreeViewItem>
    </Box>
  );
};
