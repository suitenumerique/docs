import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from 'next/document';

import { fallbackLng } from '../i18n/config';

// Runs before hydration to set the Cunningham theme class on <html>, so the
// correct colour scheme paints on first frame (no flash). Mirrors the logic in
// useCunninghamTheme (storage key + light->`default`, dark->`dark`). Keep in sync.
const THEME_INIT_SCRIPT = `(function(){try{
var m=localStorage.getItem('doc-theme-mode')||'system';
var dark=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var t=dark?'dark':'default';
var r=document.documentElement;
r.classList.forEach(function(c){if(c.indexOf('cunningham-theme--')===0){r.classList.remove(c);}});
r.classList.add('cunningham-theme--'+t);
}catch(e){}})();`;

class MyDocument extends Document<{ locale: string }> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      locale: ctx.locale || fallbackLng,
    };
  }

  render() {
    return (
      <Html lang={this.props.locale} suppressHydrationWarning>
        <Head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
