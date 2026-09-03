import { Button, ButtonProps } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import AddSVG from '@/assets/icons/ui-kit/add.svg';
import { Box, Icon } from '@/components';
import { Doc, useCreateChildDoc, useTrans } from '@/docs/doc-management';
import { DocToolBox } from '@/docs/doc-management/components/DocToolBox';
import MoreIcon from '@/icons/more_horiz.svg';

import {
  CLASS_TREE_ITEM_ACTIONS,
  CLASS_TREE_ITEM_ACTIONS_WRAPPER,
} from '../utils';

// Module-level so the reference stays stable and the memoized `DocToolBox`
// isn't forced to re-render on every parent render.
const TOOLBOX_BUTTON_PROPS: ButtonProps = {
  color: 'brand',
  icon: <MoreIcon width={16} height={16} aria-hidden="true" />,
  size: 'nano',
  tabIndex: -1,
};

type DocTreeItemActionsProps = {
  doc: Doc;
  onCreateSuccess?: (newDoc: Doc) => void;
  onOpenChange?: (isOpen: boolean) => void;
};

export const DocTreeItemActions = ({
  doc,
  onCreateSuccess,
  onOpenChange,
}: DocTreeItemActionsProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();

  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (newDoc) => {
      onCreateSuccess?.(newDoc);
      void router.push(`/docs/${newDoc.id}`);
    },
  });

  return (
    <Box
      $direction="row"
      $align="center"
      $gap="4xs"
      className={`${CLASS_TREE_ITEM_ACTIONS} ${CLASS_TREE_ITEM_ACTIONS_WRAPPER} actions`}
      role="toolbar"
      aria-label={t('Actions for {{title}}', {
        title: doc.title || untitledDocument,
      })}
      tabIndex={-1}
      $css={css`
        & button {
          height: 24px;
          width: 24px;
          padding: 0;
          justify-content: center;
          &:focus-visible {
            box-shadow: 0 0 0 2px
              var(--c--contextuals--border--semantic--brand--primary);
          }
        }
      `}
    >
      <DocToolBox
        doc={doc}
        isCurrentDoc={doc.id === router.query.id}
        onOpenChange={onOpenChange}
        buttonProps={TOOLBOX_BUTTON_PROPS}
      />
      {doc.abilities.children_create && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();

            createChildDoc({ parentId: doc.id });
          }}
          aria-label={t('Add a sub page')}
          data-testid="doc-tree-item-actions-add-child"
          tabIndex={-1}
          color="brand"
          variant="tertiary"
          size="small"
        >
          <Icon
            $color="inherit"
            icon={<AddSVG width={16} height={16} aria-hidden="true" />}
          />
        </Button>
      )}
    </Box>
  );
};
