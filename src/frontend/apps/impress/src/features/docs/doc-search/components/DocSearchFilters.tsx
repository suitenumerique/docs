import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { FilterDropdown } from '@/components/filter/FilterDropdown';

export enum DocSearchTarget {
  ALL = 'all',
  CURRENT = 'current',
}

export type DocSearchFiltersValues = {
  target?: DocSearchTarget;
};

export type DocSearchFiltersProps = {
  values?: DocSearchFiltersValues;
  onValuesChange?: (values: DocSearchFiltersValues) => void;
  onReset?: () => void;
};

export const DocSearchFilters = ({
  values,
  onValuesChange,
  onReset,
}: DocSearchFiltersProps) => {
  const { t } = useTranslation();
  const hasFilters = Object.keys(values ?? {}).length > 0;
  const handleTargetChange = (target: DocSearchTarget) => {
    onValuesChange?.({ ...values, target });
  };

  return (
    <Box
      $direction="row"
      $align="center"
      $height="35px"
      $justify="space-between"
      $gap="10px"
      data-testid="doc-search-filters"
      $margin={{ vertical: 'base' }}
    >
      <Box $direction="row" $align="center" $gap="10px">
        <FilterDropdown
          selectedValue={values?.target}
          options={[
            {
              label: t('All docs'),
              value: DocSearchTarget.ALL,
              callback: () => handleTargetChange(DocSearchTarget.ALL),
            },
            {
              label: t('Current doc'),
              value: DocSearchTarget.CURRENT,
              callback: () => handleTargetChange(DocSearchTarget.CURRENT),
            },
          ]}
        />
      </Box>
      {hasFilters && (
        <Button color="primary-text" size="small" onClick={onReset}>
          {t('Reset')}
        </Button>
      )}
    </Box>
  );
};
