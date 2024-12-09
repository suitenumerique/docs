import { Command } from 'cmdk';

import { Box } from '../Box';

import { QuickSearchData, QuickSearchProps } from './QuickSearch';
import { QuickSearchItem } from './QuickSearchItem';

type Props<T> = {
  group: QuickSearchData<T>;
  onSelect?: QuickSearchProps<T>['onSelect'];
  renderElement: QuickSearchProps<T>['renderElement'];
};

export const QuickSearchGroup = <T,>({
  group,
  onSelect,
  renderElement,
}: Props<T>) => {
  return (
    <Box $margin={{ top: 'base' }}>
      <Command.Group
        key={group.groupName}
        heading={group.groupName}
        forceMount={false}
      >
        {group.startActions?.map((action, index) => {
          return (
            <QuickSearchItem
              key={`${group.groupName}-action-${index}`}
              onSelect={action.onSelect}
            >
              {action.content}
            </QuickSearchItem>
          );
        })}
        {group.elements.map((groupElement, index) => {
          return (
            <QuickSearchItem
              key={`${group.groupName}-element-${index}`}
              onSelect={() => {
                onSelect?.(groupElement);
              }}
            >
              {renderElement?.(groupElement)}
            </QuickSearchItem>
          );
        })}
        {group.endActions?.map((action, index) => {
          return (
            <QuickSearchItem
              key={`${group.groupName}-action-${index}`}
              onSelect={action.onSelect}
            >
              {action.content}
            </QuickSearchItem>
          );
        })}
        {group.emptyString && group.elements.length === 0 && (
          <span className="ml-b clr-greyscale-500">{group.emptyString}</span>
        )}
      </Command.Group>
    </Box>
  );
};
