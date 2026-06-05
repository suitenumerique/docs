import { Switch } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';

import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';

export const DocSearchFilters = () => {
  const { t } = useTranslation();
  const { setFilter, filter } = useDocSearchFilterStore();

  return (
    /**
     * The switch is not focusable, so we wrap it in a div that can be focused
     * and handle the keydown event to toggle the switch with
     * space key for accessibility reasons
     */
    <Box
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          setFilter(filter === 'all' ? 'current' : 'all');
        }
      }}
      $css={css`
        &:focus-visible .c__switch__rail {
          outline: none;
          box-shadow: 0 0 0 2px
            var(--c--contextuals--border--semantic--brand--primary);
        }
        // Remove the default focus style of the switch component
        .c__checkbox:focus-within {
          border: none;
          box-shadow: none;
          outline: 0;
        }
      `}
    >
      <Switch
        labelSide="right"
        label={t('All docs')}
        checked={filter === 'all'}
        onChange={() => setFilter(filter === 'all' ? 'current' : 'all')}
        aria-label={t(
          'Toggle to search in all documents or only in current document',
        )}
      />
    </Box>
  );
};
