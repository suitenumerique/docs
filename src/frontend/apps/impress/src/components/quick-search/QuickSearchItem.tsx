import { Command } from 'cmdk';
import { PropsWithChildren } from 'react';

type Props = {
  onSelect?: (value: string) => void;
  id?: string;
};
export const QuickSearchItem = ({
  children,
  onSelect,
  id,
}: PropsWithChildren<Props>) => {
  return (
    <Command.Item value={id} onSelect={onSelect}>
      {children}
    </Command.Item>
  );
};
