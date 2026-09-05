import {
  Spinner,
  TreeViewItem,
  TreeViewNodeProps,
  TreeViewNodeTypeEnum,
  useTreeContext,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, StyledLink, Text } from '@/components';
import {
  Doc,
  DocIcon,
  getEmojiAndTitle,
  useTrans,
} from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import { useTreeItemActions } from '../hooks/useTreeItemActions';
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
  const { isMobile } = useResponsiveStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { closePanel } = useLeftPanelStore();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title || '');
  const displayTitle = titleWithoutEmoji || untitledDocument;

  const itemRef = useRef<HTMLAnchorElement>(null);

  const focusRow = useCallback(() => {
    // Keep react-arborist's notion of the focused node in sync…
    node.focus();
    /**
     * …but move the DOM focus ourselves. The library only does it from an
     * effect keyed on `isFocused` *changing*, and it is already true whenever
     * focus sits on one of this row's own buttons — so `node.focus()` alone
     * would leave focus right where it is.
     */
    itemRef.current?.closest<HTMLElement>('.c__tree-view--row')?.focus();
  }, [node]);

  /**
   * F2 / arrows step through the item's actions (emoji button, then the toolbar
   * buttons) and Escape leaves them; the very first F2 is handled by the
   * ui-components row itself (row → emoji button).
   */
  const {
    areActionsVisible,
    onMenuOpenChange,
    handleActionsKeyDown,
    itemProps,
  } = useTreeItemActions({
    isActive: node.isFocused,
    focusItem: focusRow,
  });

  const afterCreate = (createdDoc: Doc) => {
    const actualChildren = node.data.children ?? [];

    if (actualChildren.length === 0) {
      treeContext?.treeData
        .handleLoadChildren(node?.data.value.id)
        .then(() => {
          node.open();

          void router.push(`/docs/${createdDoc.id}`);

          if (isMobile) {
            closePanel();
          }
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
      if (isMobile) {
        closePanel();
      }
    }
  };

  const isCurrentPage = router.query?.id === doc.id;
  const isDeleted = !!doc.deleted_at;

  return (
    <StyledLink
      {...itemProps}
      ref={itemRef}
      className="--docs-sub-page-item"
      /**
       * Conflict with the react-arborist DND.
       * It should be disabled to have the DND working properly.
       */
      draggable={false}
      href={`/docs/${doc.id}`}
      tabIndex={-1}
      aria-label={
        isDeleted
          ? t('{{title}} (deleted)', { title: displayTitle })
          : t('Open document {{title}}', { title: displayTitle })
      }
      aria-current={isCurrentPage ? 'page' : undefined}
      data-testid={`doc-sub-page-item-${doc.id}`}
      onKeyDown={handleActionsKeyDown}
      aria-disabled={isDeleted}
      onClick={(e) => {
        if (isDeleted) {
          e.preventDefault();
          return;
        }

        if (isMobile) {
          closePanel();
        }
      }}
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
        .c__tree-view--node {
          padding-right: var(--c--globals--spacings--xxxs);
          height: 32px;
        }
        .c__tree-view--node.isFocused {
          outline: none !important;
          border-radius: var(--c--globals--spacings--st);
        }
        /* Only one focus ring at a time: the toolbar and emoji draw their own. */
        &:has(
            .doc-tree-root-item-actions *:focus,
            .--docs--doc-icon:focus-visible
          )
          .c__tree-view--node.isFocused {
          box-shadow: none !important;
        }
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--gray--tertiary
          );
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
        </Box>
        {areActionsVisible && (
          <DocTreeItemActions
            doc={doc}
            onOpenChange={onMenuOpenChange}
            onCreateSuccess={afterCreate}
          />
        )}
      </TreeViewItem>
    </StyledLink>
  );
};
