import { Button } from '@gouvfr-lasuite/cunningham-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { DocDefaultFilter, DocsOrdering } from '@/docs/doc-management/types';
import ArrowUpDownIcon from '@/icons/arrow-up-down.svg';
import ClockIcon from '@/icons/clock.svg';
import { useResponsiveStore } from '@/stores';

type DocsGridColumnNameProps = {
  ordering: DocsOrdering;
  setOrdering: React.Dispatch<React.SetStateAction<DocsOrdering>>;
  target?: DocDefaultFilter;
};

export const DocsGridColumnName = ({
  target = DocDefaultFilter.ALL_DOCS,
  ordering,
  setOrdering,
}: DocsGridColumnNameProps) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();

  const canSort = target !== DocDefaultFilter.TRASHBIN;

  const toggleOrdering = (field: 'title' | 'updated_at') => {
    setOrdering((prevOrdering) =>
      prevOrdering === field ? (`-${field}` as DocsOrdering) : field,
    );
  };

  return (
    <Box
      $display="grid"
      $css={css`
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
      `}
      data-testid="docs-grid-header"
    >
      <Box $padding={{ all: '3xs' }}>
        {canSort ? (
          <DocGridSortButton
            label={t('Name')}
            ariaLabel={t('Name')}
            ordering={ordering}
            field="title"
            onClick={() => toggleOrdering('title')}
          />
        ) : (
          <Text $size="xs" $variation="secondary" $weight="500">
            {t('Name')}
          </Text>
        )}
      </Box>
      {!isSmallMobile && (
        <Box $padding={{ vertical: '3xs' }}>
          {canSort ? (
            <DocGridSortButton
              label={
                <Text
                  $size="xs"
                  $weight="500"
                  $variation="secondary"
                  $direction="row"
                  $align="center"
                  $gap="2xs"
                >
                  <ClockIcon width={16} height={16} aria-hidden="true" />{' '}
                  {t('Last modified')}
                </Text>
              }
              ariaLabel={t('Last modified')}
              ordering={ordering}
              field="updated_at"
              onClick={() => toggleOrdering('updated_at')}
            />
          ) : (
            <Text $size="xs" $weight="500" $variation="secondary">
              {t('Days remaining')}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

const DocGridSortButton = ({
  label,
  ariaLabel,
  field,
  ordering,
  onClick,
}: {
  label: ReactNode;
  ariaLabel: string;
  field: 'title' | 'updated_at';
  ordering: DocsOrdering;
  onClick: () => void;
}) => {
  const { t } = useTranslation();
  const isDesc = ordering === `-${field}`;
  const isActive = ordering === field || isDesc;

  return (
    <Box $direction="row" $align="center" $gap="4xs">
      <Text $size="xs" $weight="500" $variation="secondary">
        {label}
      </Text>
      <Button
        size="nano"
        onClick={onClick}
        data-testid={`docs-grid-sort-${field}`}
        aria-label={
          isActive
            ? t('Sorted by {{label}}, {{direction}}. Activate to reverse.', {
                label: ariaLabel,
                direction: isDesc ? t('descending') : t('ascending'),
              })
            : t('Sort by {{label}}', { label: ariaLabel })
        }
        iconPosition="right"
        icon={<ArrowUpDownIcon width={16} height={16} aria-hidden="true" />}
        variant="tertiary"
        color={isActive ? 'brand' : 'neutral'}
      />
    </Box>
  );
};
