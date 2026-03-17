import { Command } from 'cmdk';
import { PropsWithChildren, ReactNode, useId, useRef, useState } from 'react';

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
  groupKey?: string;
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
  groupKey?: string;
  beforeList?: ReactNode;
};

export const QuickSearch = ({
  onFilter,
  inputContent,
  inputValue,
  showInput = true,
  label,
  placeholder,
  beforeList,
  children,
}: PropsWithChildren<QuickSearchProps>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  /**
   * Hack to prevent cmdk from auto-selecting the first element on open
   *
   * TODO: Find a clean solution to prevent cmdk from auto-selecting
   * the first element on open
   */
  const [selectedValue, _] = useState('__none__');

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command
          label={label}
          shouldFilter={false}
          ref={ref}
          tabIndex={-1}
          disablePointerSelection
          value={selectedValue}
        >
          {showInput && (
            <QuickSearchInput
              withSeparator={hasChildrens(children)}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
              listId={listId}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          {beforeList}
          <Command.List id={listId} aria-label={label} role="listbox">
            <Box>{children}</Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
