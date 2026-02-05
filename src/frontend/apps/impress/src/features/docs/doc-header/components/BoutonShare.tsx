import { Button, ButtonElement } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { RefObject, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { Doc } from '@/docs/doc-management';

interface BoutonShareProps {
  displayNbAccess: boolean;
  doc: Doc;
  isDisabled?: boolean;
  isHidden?: boolean;
  open: () => void;
  buttonRef?: RefObject<ButtonElement | null>;
}

export const BoutonShare = ({
  displayNbAccess,
  doc,
  isDisabled,
  isHidden,
  open,
  buttonRef,
}: BoutonShareProps) => {
  const { t } = useTranslation();
  const treeContext = useTreeContext<Doc>();

  /**
   * Following the change where there is no default owner when adding a sub-page,
   * we need to handle both the case where the doc is the root and the case of sub-pages.
   */
  const hasAccesses = useMemo(() => {
    if (treeContext?.root?.id === doc.id) {
      return doc.nb_accesses_direct > 1 && displayNbAccess;
    }

    return doc.nb_accesses_direct >= 1 && displayNbAccess;
  }, [doc.id, treeContext?.root, doc.nb_accesses_direct, displayNbAccess]);

  if (isHidden) {
    return null;
  }

  if (hasAccesses) {
    return (
      <Box
        $css={css`
          .c__button--medium {
            height: var(--c--globals--spacings--lg);
            padding: 10px var(--c--globals--spacings--xs);
            gap: 7px;
          }
        `}
      >
        <Button
          ref={buttonRef}
          aria-label={t('Share button')}
          variant="secondary"
          icon={
            <Icon
              iconName="group"
              $color="inherit"
              variant="filled"
              disabled={isDisabled}
            />
          }
          onClick={open}
          size="medium"
          disabled={isDisabled}
        >
          {doc.nb_accesses_direct}
        </Button>
      </Box>
    );
  }

  return (
    <Button
      ref={buttonRef}
      color="brand"
      variant="tertiary"
      onClick={open}
      size="medium"
      disabled={isDisabled}
    >
      {t('Share')}
    </Button>
  );
};
