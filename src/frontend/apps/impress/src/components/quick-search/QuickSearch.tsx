import { Command } from 'cmdk';
import { ReactNode, useRef } from 'react';

import { Box } from '../Box';

import { QuickSearchGroup } from './QuickSearchGroup';
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

export type QuickSearchProps<T> = {
  data?: QuickSearchData<T>[];
  onFilter?: (str: string) => void;
  renderElement?: (element: T) => ReactNode;
  onSelect?: (element: T) => void;
  inputValue?: string;
  inputContent?: ReactNode;
  showInput?: boolean;
  loading?: boolean;
  label?: string;
  placeholder?: string;
  children?: ReactNode;
};

export const QuickSearch = <T,>({
  onSelect,
  onFilter,
  inputContent,
  inputValue,
  loading,
  showInput = true,
  data,
  renderElement,
  label,
  placeholder,
  children,
}: QuickSearchProps<T>) => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command label={label} shouldFilter={false} ref={ref}>
          {showInput && (
            <QuickSearchInput
              loading={loading}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          <Command.List>
            <Box>
              {!loading &&
                data?.map((group) => {
                  return (
                    <QuickSearchGroup
                      key={group.groupName}
                      group={group}
                      onSelect={onSelect}
                      renderElement={renderElement}
                    />
                  );
                })}
              {children}
            </Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
