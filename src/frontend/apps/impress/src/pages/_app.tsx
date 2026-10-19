import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';

import { SkipToContent } from '@/components';
import { AppProvider } from '@/core/';
import { useOffline, useSWRegister } from '@/features/service-worker/';
import '@/i18n/initI18n';
import { NextPageWithLayout } from '@/types/next';

import './globals.css';

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  useSWRegister();
  useOffline();

  const getLayout = Component.getLayout ?? ((page) => page);
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>
          {t('Docs', {
            description: 'Product name, shown in page titles and the logo',
          })}
        </title>
        <meta
          property="og:title"
          content={t('Docs', {
            description: 'Product name, shown in page titles and the logo',
          })}
          key="title"
        />
        <meta
          name="description"
          content={t(
            'Docs: Your new companion to collaborate on documents efficiently, intuitively, and securely.',
            {
              description:
                'Meta description of the website, shown in search engines',
            },
          )}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppProvider>
        <SkipToContent />
        {getLayout(<Component {...pageProps} />)}
      </AppProvider>
    </>
  );
}
