import { Head, Html, Main, NextScript } from 'next/document';
import { useTranslation } from 'react-i18next';

export default function RootLayout() {
  const { i18n } = useTranslation();

  return (
    <Html lang={i18n.language?.split('-')[0]}>
      <Head />
      <body suppressHydrationWarning={process.env.NODE_ENV === 'development'}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
