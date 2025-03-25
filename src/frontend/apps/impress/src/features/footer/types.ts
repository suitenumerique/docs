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

export interface ContentType {
  externalLinks?: Link[];
  legalLinks?: Link[];
  bottomInformation?: BottomInformation;
}
