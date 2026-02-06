import Image from 'next/image';

type Imagetype = React.ComponentProps<typeof Image> & {
  withTitle: boolean;
};

export interface HeaderType {
  logo?: Imagetype;
  icon?: Imagetype;
}
