import debug from 'debug';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';

import { AppProvider } from '@/core/';
import { useSWRegister } from '@/features/service-worker/';
import '@/i18n/initI18n';
import { NextPageWithLayout } from '@/types/next';

import './globals.css';

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  useSWRegister();
  const getLayout = Component.getLayout ?? ((page) => page);
  const { t } = useTranslation();

  if (process.env.NODE_ENV === 'development') {
    /**
     *  Add and enable new debug namespaces as needed
     *
     *  They can also be enabled via DEBUG environment variable
     *    Example: DEBUG=features:language,no-cache
     *
     *  They can also be enabled in the browser console
     *    Example: window.debug = 'features:language,no-cache';
     */
    debug.enable(['no-cache', 'features:language'].join(','));
  }

  return (
    <>
      <Head>
        <title>{t('Docs')}</title>
        <meta
          name="description"
          content={t(
            'Docs: Your new companion to collaborate on documents efficiently, intuitively, and securely.',
          )}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link
          rel="icon"
          href="/favicon.png"
          type="image/png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          href="/favicon-dark.png"
          type="image/png"
          media="(prefers-color-scheme: dark)"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppProvider>{getLayout(<Component {...pageProps} />)}</AppProvider>
    </>
  );
}
