import { Loader } from '@openfun/cunningham-react';
import { Command } from 'cmdk';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';
import { Icon } from '../Icon';

type Props = {
  loading?: boolean;
  inputValue?: string;
  onFilter?: (str: string) => void;
  placeholder?: string;
  children?: ReactNode;
  withSeparator?: boolean;
};
export const QuickSearchInput = ({
  loading,
  inputValue,
  onFilter,
  placeholder,
  children,
  withSeparator: separator = true,
}: Props) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  if (children) {
    return (
      <>
        {children}
        {separator && <HorizontalSeparator />}
      </>
    );
  }

  return (
    <>
      <Box
        $direction="row"
        $align="center"
        className="quick-search-input"
        $gap={spacing['2xs']}
        $padding={{ all: 'base' }}
      >
        {!loading && <Icon iconName="search" $variation="600" />}
        {loading && (
          <div>
            <Loader size="small" />
          </div>
        )}
        <Command.Input
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus={true}
          aria-label={t('Quick search input')}
          value={inputValue}
          role="combobox"
          placeholder={placeholder ?? t('Search')}
          onValueChange={onFilter}
        />
      </Box>
      {separator && <HorizontalSeparator $withPadding={false} />}
    </>
  );
};
