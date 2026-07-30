import { captureException } from '@sentry/nextjs';
import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { ReactElement, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { LOGIN_URL, setAuthUrl, useAuth } from '@/features/auth';
import { useCreateDoc } from '@/features/docs/doc-management';
import { useSkeletonStore } from '@/features/skeletons';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { setIsSkeletonVisible } = useSkeletonStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams.get('title');
  const { authenticated } = useAuth();

  const { mutateAsync: createDocAsync, data: doc } = useCreateDoc();

  const redirectToDoc = useCallback(
    (docId: string) => {
      void router.push(`/docs/${docId}`);
    },
    [router],
  );

  useEffect(() => {
    setIsSkeletonVisible(true);
  }, [setIsSkeletonVisible]);

  useEffect(() => {
    if (doc) {
      return;
    }
    if (!authenticated) {
      setAuthUrl();
      window.location.replace(LOGIN_URL);
      return;
    }

    // Link configuration is managed in Drive: the legacy link-reach/link-role
    // query params are ignored.
    createDocAsync({
      title: title || undefined,
    })
      .then((createdDoc) => {
        redirectToDoc(createdDoc.id);
      })
      .catch((error) => {
        captureException(error, {
          extra: {
            title,
          },
        });
      });
  }, [authenticated, createDocAsync, doc, redirectToDoc, title]);

  return (
    <>
      <Head>
        <title>{`${t('New document')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('New document')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Loading />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <MainLayout enableResizablePanel={false}>{page}</MainLayout>
    </>
  );
};

export default Page;
