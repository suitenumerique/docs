import { Command } from 'cmdk';
import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';
import { Icon } from '../Icon';

type QuickSearchInputProps = {
  inputValue?: string;
  onFilter?: (str: string) => void;
  placeholder?: string;
  withSeparator?: boolean;
  listId?: string;
  isExpanded?: boolean;
};
export const QuickSearchInput = ({
  inputValue,
  onFilter,
  placeholder,
  children,
  withSeparator: separator = true,
  listId,
}: PropsWithChildren<QuickSearchInputProps>) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

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
        $gap={spacingsTokens['2xs']}
        $padding={{ horizontal: 'base', vertical: 'xs' }}
      >
        <Icon iconName="search" $variation="secondary" aria-hidden="true" />
        <Command.Input
          autoFocus={true}
          aria-label={t('Quick search input')}
          aria-controls={listId}
          value={inputValue}
          role="combobox"
          placeholder={placeholder ?? t('Search')}
          onValueChange={onFilter}
          maxLength={254}
          data-testid="quick-search-input"
        />
      </Box>
      {separator && <HorizontalSeparator $margin={{ top: '2xs' }} />}
    </>
  );
};
