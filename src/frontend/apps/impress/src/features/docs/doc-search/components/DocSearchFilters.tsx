import { Switch } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';

import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';

export const DocSearchFilters = () => {
  const { t } = useTranslation();
  const { setFilter, filter } = useDocSearchFilterStore();
  const isAll = filter === 'all';
  const toggle = () => setFilter(isAll ? 'current' : 'all');

  return (
    /**
     * The switch is not focusable, so we wrap it in a div that can be focused
     * and handle the keydown event to toggle the switch with
     * space or enter key for accessibility reasons
     */
    <Box
      role="switch"
      aria-checked={isAll}
      aria-label={t('Search in all documents')}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      $css={css`
        &:focus-visible {
          outline: none;

          .c__switch__rail {
            outline: none;
            box-shadow: 0 0 0 2px
              var(--c--contextuals--border--semantic--brand--primary);
          }
        }
        // Remove the default focus style of the switch component
        .c__checkbox {
          border: none;
          box-shadow: none;
          outline: 0;
        }
        & *:focus-visible {
          outline: none;
        }
      `}
    >
      <Switch
        labelSide="right"
        label={t('All docs')}
        checked={isAll}
        onChange={toggle}
        aria-label={t(
          'Toggle to search in all documents or only in current document',
        )}
        tabIndex={-1}
      />
    </Box>
  );
};
