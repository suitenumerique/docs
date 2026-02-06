import Image from 'next/image';

type Imagetype = React.ComponentProps<typeof Image>;

export interface FooterType {
  default: ContentType;
  [key: string]: ContentType;
}

export interface BottomInformationType {
  label: string;
  link?: LinkType;
}

export interface LinkType {
  label: string;
  href: string;
}

export type LogoType = Imagetype & {
  withTitle: boolean;
};

export interface ContentType {
  logo?: LogoType;
  externalLinks?: LinkType[];
  legalLinks?: LinkType[];
  bottomInformation?: BottomInformationType;
}
