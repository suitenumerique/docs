import { Command } from 'cmdk';
import { ReactNode, useRef } from 'react';

import { hasChildrens } from '@/utils/children';

import { Box } from '../Box';

import { QuickSearchInput } from './QuickSearchInput';
import { QuickSearchStyle } from './QuickSearchStyle';

export type QuickSearchAction = {
  onSelect?: () => void;
  content: ReactNode;
};

export type QuickSearchData<T> = {
  groupName: string;
  elements: T[];
  emptyString?: string;
  startActions?: QuickSearchAction[];
  endActions?: QuickSearchAction[];
  showWhenEmpty?: boolean;
};

export type QuickSearchProps = {
  onFilter?: (str: string) => void;
  inputValue?: string;
  inputContent?: ReactNode;
  showInput?: boolean;
  loading?: boolean;
  label?: string;
  placeholder?: string;
  children?: ReactNode;
};

export const QuickSearch = ({
  onFilter,
  inputContent,
  inputValue,
  loading,
  showInput = true,
  label,
  placeholder,
  children,
}: QuickSearchProps) => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command label={label} shouldFilter={false} ref={ref}>
          {showInput && (
            <QuickSearchInput
              loading={loading}
              withSeparator={hasChildrens(children)}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          <Command.List>
            <Box>{children}</Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
