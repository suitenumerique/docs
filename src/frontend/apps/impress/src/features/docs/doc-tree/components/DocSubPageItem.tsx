import { ButtonElement } from '@gouvfr-lasuite/cunningham-react';
import {
  Spinner,
  TreeViewDataType,
  TreeViewItem,
  TreeViewNodeProps,
  TreeViewNodeTypeEnum,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import {
  Doc,
  DocIcon,
  getEmojiAndTitle,
  useTrans,
} from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import { isDocNode } from '../utils';

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
  if (props.node.data.value.nodeType === TreeViewNodeTypeEnum.VIEW_MORE) {
    return <DocSubPageLoadMore {...props} />;
  }

  if (!isDocNode(props.node.data.value)) {
    return <TreeViewItem {...props} />;
  }

  return <DocSubPageItemContent {...props} />;
};

const DocSubPageLoadMore = (props: TreeViewNodeProps<Doc>) => {
  const treeContext = useTreeContext<Doc>();
  const { t } = useTranslation();
  const loaderRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef<boolean>(false);

  /**
   * Use IntersectionObserver to trigger loading more children when the "Load More" item comes into view.
   * This allows for infinite scrolling of child nodes without needing a "Load More" button click.
   * The observer is disconnected when the component unmounts to prevent memory leaks.
   */
  useEffect(() => {
    const el = loaderRef.current;
    const parentKey = props.node.data.parentKey;
    if (!el || !parentKey) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || inFlightRef.current) {
          return;
        }
        inFlightRef.current = true;
        void treeContext?.treeData.handleLoadChildren(parentKey).finally(() => {
          inFlightRef.current = false;
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      ref={loaderRef}
      $align="center"
      $justify="center"
      $padding={{ vertical: 'xs' }}
      role="status"
      aria-label={t('Loading more documents')}
    >
      <Spinner size="sm" aria-hidden="true" />
    </Box>
  );
};

const DocSubPageItemContent = (props: TreeViewNodeProps<Doc>) => {
  const doc = props.node.data.value as Doc;
  const treeContext = useTreeContext<Doc>();
  const { untitledDocument } = useTrans();
  const { node } = props;
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title || '');
  const displayTitle = titleWithoutEmoji || untitledDocument;

  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0) {
      treeContext?.treeData
        .handleLoadChildren(node?.data.value.id)
        .then((allChildren) => {
          node.open();

          void router.push(`/docs/${createdDoc.id}`);
          treeContext?.treeData.setChildren(
            node.data.value.id,
            allChildren as TreeViewDataType<Doc>[],
          );
          togglePanel({ type: 'mobile' });
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
      void router.push(`/docs/${createdDoc.id}`);
      togglePanel({ type: 'mobile' });
    }
  };

  const docTitle = doc.title || untitledDocument;
  const isCurrentPage = router.query?.id === doc.id;
  const isDisabled = !!doc.deleted_at;
  const actionsRef = useRef<HTMLDivElement>(null);
  const buttonOptionRef = useRef<ButtonElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isInActions = !!target?.closest('.light-doc-item-actions');
    const isOnEmojiButton = !!target?.closest('.--docs--doc-icon');

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
    <StyledLink
      className="--docs-sub-page-item"
      draggable={doc.abilities.move && isDesktop}
      href={`/docs/${doc.id}`}
      tabIndex={-1}
      aria-label={
        isDisabled
          ? t('{{title}} (deleted)', { title: docTitle })
          : t('Open document {{title}}', { title: docTitle })
      }
      aria-current={isCurrentPage ? 'page' : undefined}
      data-testid={`doc-sub-page-item-${doc.id}`}
      onKeyDown={handleKeyDown}
      aria-disabled={isDisabled}
      onClick={isDisabled ? (e) => e.preventDefault() : undefined}
      /**
       * Prevent the default click behavior when clicking on the expand/collapse arrow to avoid
       * navigating to the document page.
       * This allows users to expand/collapse the tree node without triggering navigation,
       * while still allowing clicks on the rest of the item to navigate as expected.
       */
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('.c__tree-view--node__arrow')) {
          e.preventDefault();
        }
      }}
      $css={css`
        background-color: var(--c--contextuals--background--surface--primary);
        text-align: left;
        display: block;
        width: 100%;
        border-radius: var(--c--globals--spacings--st);
        .light-doc-item-actions {
          display: ${menuOpen || !isDesktop ? 'flex' : 'none'};
          right: var(--c--globals--spacings--0);
        }
        .c__tree-view--node {
          padding-right: var(--c--globals--spacings--xxxs);
          height: 32px;
        }
        .c__tree-view--node.isFocused {
          outline: none !important;
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
      <TreeViewItem {...props}>
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
            tabIndex: -1,
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
          $gap="xs"
          $minHeight="24px"
          $minWidth="0"
          $width="100%"
          $overflow="hidden"
        >
          <Text $css={ItemTextCss} $size="sm">
            {displayTitle}
          </Text>
          {doc.nb_accesses_direct >= 1 && (
            <Icon
              variant="filled"
              iconName="group"
              $size="md"
              aria-label={t('Shared with others')}
            />
          )}
        </Box>
        <Box
          $direction="row"
          $align="center"
          className="light-doc-item-actions actions"
          role="toolbar"
          aria-label={t('Actions for {{title}}', { title: docTitle })}
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
      </TreeViewItem>
    </StyledLink>
  );
};
