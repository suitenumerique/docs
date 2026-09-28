import { Button } from '@gouvfr-lasuite/ui-components';
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
  const canSort =
    target !== DocDefaultFilter.TRASHBIN && target !== DocDefaultFilter.STARRED;

  return (
    <Box
      $display="grid"
      $css={css`
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
      `}
      data-testid="docs-grid-header"
    >
      {canSort ? (
        <DocGridColumnWithSort ordering={ordering} setOrdering={setOrdering} />
      ) : (
        <DocGridColumnWithoutSort target={target} />
      )}
    </Box>
  );
};

const DocGridColumnWithSort = ({
  ordering,
  setOrdering,
}: {
  ordering: DocsOrdering;
  setOrdering: React.Dispatch<React.SetStateAction<DocsOrdering>>;
}) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();
  const defaultOrdering: Record<'title' | 'updated_at', DocsOrdering> = {
    title: 'title',
    updated_at: '-updated_at',
  };
  const toggleOrdering = (field: 'title' | 'updated_at') => {
    setOrdering((prevOrdering) => {
      if (prevOrdering === field) {
        return `-${field}` as DocsOrdering;
      }
      if (prevOrdering === `-${field}`) {
        return field;
      }
      return defaultOrdering[field];
    });
  };

  return (
    <>
      <Box $padding={{ all: '3xs' }}>
        <DocGridSortButton
          label={t('Name')}
          ariaLabel={t('Name')}
          ordering={ordering}
          field="title"
          defaultOrdering={defaultOrdering.title}
          onClick={() => toggleOrdering('title')}
        />
      </Box>
      {!isSmallMobile && (
        <Box $padding={{ vertical: '3xs' }}>
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
            defaultOrdering={defaultOrdering.updated_at}
            onClick={() => toggleOrdering('updated_at')}
          />
        </Box>
      )}
    </>
  );
};

const DocGridColumnWithoutSort = ({ target }: { target: DocDefaultFilter }) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();

  return (
    <>
      <Box $padding={{ all: '3xs' }}>
        <Text $size="xs" $variation="secondary" $weight="500">
          {t('Name')}
        </Text>
      </Box>
      {!isSmallMobile && (
        <Box $padding={{ vertical: '3xs' }}>
          <Text
            $size="xs"
            $weight="500"
            $variation="secondary"
            $direction="row"
            $align="center"
            $gap="2xs"
          >
            <ClockIcon width={16} height={16} aria-hidden="true" />{' '}
            {target === DocDefaultFilter.STARRED
              ? t('Last modified')
              : t('Days remaining')}
          </Text>
        </Box>
      )}
    </>
  );
};

const DocGridSortButton = ({
  label,
  ariaLabel,
  field,
  ordering,
  defaultOrdering,
  onClick,
}: {
  label: ReactNode;
  ariaLabel: string;
  field: 'title' | 'updated_at';
  ordering: DocsOrdering;
  defaultOrdering: DocsOrdering;
  onClick: () => void;
}) => {
  const { t } = useTranslation();
  const isActive = ordering?.includes(field);
  const isDesc = ordering !== defaultOrdering;

  return (
    <Box $direction="row" $align="center" $gap="2xs">
      <Text $size="xs" $weight="500" $variation="secondary">
        {label}
      </Text>
      <Button
        size="nano"
        onClick={onClick}
        data-testid={`docs-grid-sort-${field}`}
        aria-label={
          isActive
            ? t(
                'Sorted documents by {{label}}, {{direction}}. Activate to reverse.',
                {
                  label: ariaLabel,
                  direction: isDesc ? t('descending') : t('ascending'),
                },
              )
            : t('Sort documents by {{label}}', { label: ariaLabel })
        }
        iconPosition="right"
        icon={<ArrowUpDownIcon width={16} height={16} aria-hidden="true" />}
        variant={isDesc ? 'tertiary' : 'secondary'}
        color={isActive ? 'brand' : 'neutral'}
      />
    </Box>
  );
};
