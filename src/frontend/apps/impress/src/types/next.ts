import type { NextPage } from 'next';

export type NextPageWithLayout<P = object> = NextPage<P> & {
  getLayout?: (page: React.ReactElement) => React.ReactNode;
  getHead?: (pageProps: P) => React.ReactNode;
};
