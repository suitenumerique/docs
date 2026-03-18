import { Command } from 'cmdk';
import { PropsWithChildren, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useFocusStore } from '@/stores';

import { Box } from '../Box';
import { Icon } from '../Icon';

type QuickSearchInputProps = {
  inputValue?: string;
  onFilter?: (str: string) => void;
  placeholder?: string;
  withSeparator?: boolean;
  listId?: string;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const addLastFocus = useFocusStore((state) => state.addLastFocus);

  useEffect(() => {
    addLastFocus(inputRef.current);
  }, [addLastFocus]);

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
        $gap={spacingsTokens['xxs']}
        $padding={{ horizontal: 'base', vertical: 'xxs' }}
      >
        <Icon iconName="search" $variation="secondary" aria-hidden="true" />
        <Command.Input
          ref={inputRef}
          autoFocus={true}
          aria-label={t('Quick search input')}
          aria-controls={listId}
          value={inputValue}
          role="combobox"
          placeholder={placeholder ?? t('Search')}
          onValueChange={onFilter}
          maxLength={254}
          minLength={6}
          data-testid="quick-search-input"
        />
      </Box>
      {separator && <HorizontalSeparator $margin={{ top: 'base' }} />}
    </>
  );
};
