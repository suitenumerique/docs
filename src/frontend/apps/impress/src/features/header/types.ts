import Image from 'next/image';

type Imagetype = React.ComponentProps<typeof Image>;

export interface HeaderType {
  logo?: Imagetype;
  icon?: Imagetype;
}
