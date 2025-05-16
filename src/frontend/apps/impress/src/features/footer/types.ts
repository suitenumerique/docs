export interface FooterType {
  default: ContentType;
  [key: string]: ContentType;
}

export interface BottomInformation {
  label: string;
  link?: Link;
}

export interface Link {
  label: string;
  href: string;
}

export interface Logo {
  src: string;
  width: string;
  alt: string;
  withTitle: boolean;
}

export interface ContentType {
  logo?: Logo;
  externalLinks?: Link[];
  legalLinks?: Link[];
  bottomInformation?: BottomInformation;
}
