import { Button, useModal } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import SharedSVG from '@/assets/icons/ui-kit/shared.svg';
import { Card } from '@/components/Card';
import { Doc } from '@/docs/doc-management/types';
import { useAuth } from '@/features/auth';
import { useFocusStore } from '@/stores/useFocusStore';

import { KEY_LIST_DOC_ACCESSES, useDocAccesses } from '../api';

const DocShareModal = dynamic(
  () =>
    import('./DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

interface DocShareButtonProps {
  doc: Doc;
  isDisabled?: boolean;
  isHidden?: boolean;
}

export const DocShareButton = ({
  doc,
  isDisabled,
  isHidden,
}: DocShareButtonProps) => {
  const { t } = useTranslation();
  const { addLastFocus, restoreFocus } = useFocusStore();
  const treeContext = useTreeContext<Doc>();
  const modalShare = useModal();
  const { data: accesses } = useDocAccesses(
    {
      docId: doc.id,
    },
    {
      enabled: doc.abilities.accesses_view,
      queryKey: [KEY_LIST_DOC_ACCESSES, doc.id],
    },
  );
  const { authenticated } = useAuth();

  const hasAccesses = !!accesses && accesses.length > 1; // more than the current user

  if (isHidden || !authenticated) {
    return null;
  }

  return (
    <>
      <Card
        className="--docs--card--share"
        $direction="row"
        $css={css`
          padding: var(--c--globals--spacings--xxxs);
          align-items: center;
          gap: var(--c--globals--spacings--xxxs);
          border-radius: var(--c--globals--spacings--xs);
          box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
        `}
      >
        <Button
          color={hasAccesses ? 'brand' : 'neutral'}
          size="small"
          variant={hasAccesses ? 'secondary' : 'tertiary'}
          onClick={(e) => {
            addLastFocus(e.currentTarget);
            modalShare.open();
          }}
          disabled={isDisabled}
          icon={
            hasAccesses ? (
              <SharedSVG width={24} height={24} aria-hidden="true" />
            ) : undefined
          }
          aria-label={hasAccesses ? t('Shared') : t('Share')}
          data-test="share-button"
        >
          {hasAccesses ? t('Shared') : t('Share')}
        </Button>
      </Card>
      {modalShare.isOpen && (
        <DocShareModal
          onClose={() => {
            modalShare.close();
            restoreFocus();
          }}
          doc={doc}
          isRootDoc={treeContext?.root?.id === doc.id}
        />
      )}
    </>
  );
};
