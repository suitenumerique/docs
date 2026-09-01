import { TreeContextType } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { RefObject, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { Doc, SimpleDocItem, useTrans } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { CLASS_DOC_TITLE } from '../../doc-header';
import { useTreeItemActions } from '../hooks/useTreeItemActions';
import { isWithinTreeItemActions } from '../utils';

import { DocTreeItemActions } from './DocTreeItemActions';

type DocTreeRootProps = {
  currentDoc: Doc;
  rootItemRef: RefObject<HTMLDivElement | null>;
  treeContext: TreeContextType<Doc | null>;
};

export const DocTreeRoot = ({
  currentDoc,
  rootItemRef,
  treeContext,
}: DocTreeRootProps) => {
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const { untitledDocument } = useTrans();
  const { t } = useTranslation();
  const router = useRouter();

  const root = treeContext.root;
  const treeApiRef = treeContext.treeApiRef;
  const isSelected =
    !!root?.id && treeContext.treeData.selectedNode?.id === root.id;

  const selectRoot = useCallback(() => {
    if (root) {
      treeContext.treeData.setSelectedNode(root);
    }
  }, [treeContext.treeData, root]);

  const focusRootItem = useCallback(() => {
    rootItemRef.current?.focus();
  }, [rootItemRef]);

  const {
    areActionsVisible,
    isMenuOpen,
    onMenuOpenChange,
    handleActionsKeyDown,
    itemProps,
  } = useTreeItemActions({
    focusItem: focusRootItem,
  });

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      // F2 / ArrowLeft / ArrowRight / Escape rove within the actions group.
      if (handleActionsKeyDown(event)) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        // ArrowDown enters the sub pages at the first row — from the item
        // itself or from one of its actions, the same as the sub page rows.
        // ArrowUp has nowhere to go (the root is the top) but must not scroll
        // the panel.
        const api = treeApiRef.current;
        const firstNode = api?.firstNode;
        if (event.key === 'ArrowDown' && api && firstNode) {
          api.focus(firstNode);
          // react-arborist only moves DOM focus from the effect that fires
          // when a row's `isFocused` flips to true. When it already considers
          // the first row focused that effect never runs, so move the focus
          // ourselves, the way `focusRow` does in `DocSubPageItem`.
          rootItemRef.current
            ?.closest('[data-testid="doc-tree"]')
            ?.querySelector<HTMLElement>(
              `[data-testid="doc-sub-page-item-${firstNode.id}"]`,
            )
            ?.closest<HTMLElement>('.c__tree-view--row')
            ?.focus();
        }
        return;
      }

      // The remaining keys act on the item itself, never on its focused actions.
      if (isWithinTreeItemActions(event)) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();

        // Already on this document: move on to its title rather than reloading.
        if (currentDoc.id === root?.id) {
          document.querySelector<HTMLElement>(`.${CLASS_DOC_TITLE}`)?.focus();
        } else if (root) {
          selectRoot();
          void router.push(`/docs/${root.id}`);
        }
      }
    },
    [
      handleActionsKeyDown,
      selectRoot,
      router,
      currentDoc.id,
      root,
      treeApiRef,
      rootItemRef,
    ],
  );

  if (!root) {
    return null;
  }

  const title = root.title || untitledDocument;

  return (
    <Box
      {...itemProps}
      ref={rootItemRef}
      data-testid="doc-tree-root-item"
      role="treeitem"
      aria-label={t('Root document {{title}}', { title })}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      $css={css`
        padding: var(--c--globals--spacings--2xs);
        border-radius: var(--c--globals--spacings--st);
        width: 100%;
        min-width: 200px;
        background-color: ${
          isSelected || isMenuOpen
            ? 'var(--c--contextuals--background--semantic--contextual--primary)'
            : 'transparent'
        };

        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--contextual--primary
          );
        }

        &:focus-visible {
          outline: none !important;
          box-shadow: 0 0 0 2px var(--c--globals--colors--brand-500) !important;
          border-radius: var(--c--globals--spacings--st);
        }

        /* Only one focus ring at a time: the toolbar draws its own. */
        &:has(.doc-tree-root-item-actions *:focus) {
          box-shadow: none !important;
        }
      `}
    >
      <StyledLink
        $css={css`
          width: 100%;
        `}
        href={`/docs/${root.id}`}
        onClick={(e) => {
          if (!e.currentTarget.contains(e.target as Node)) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          e.preventDefault();
          selectRoot();
          void router.push(`/docs/${root.id}`);
        }}
        aria-label={`${t('Open root document')}: ${title}`}
        tabIndex={-1} // the item itself is the tab stop
      >
        <Box $direction="row" $align="center" $width="100%">
          <SimpleDocItem doc={root} showDate={true} />
          {areActionsVisible && (
            <DocTreeItemActions
              doc={root}
              onOpenChange={onMenuOpenChange}
              onCreateSuccess={(createdDoc) => {
                const newDoc = {
                  ...createdDoc,
                  children: [],
                  childrenCount: 0,
                  parentId: root.id,
                };
                treeContext.treeData.addChild(null, newDoc);

                if (isMobile) {
                  closePanel();
                }
              }}
            />
          )}
        </Box>
      </StyledLink>
    </Box>
  );
};
