import { captureException } from '@sentry/nextjs';
import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { ReactElement, useCallback, useEffect } from 'react';

import { Loading } from '@/components';
import {
  LinkReach,
  LinkRole,
  useCreateDoc,
} from '@/features/docs/doc-management';
import { useUpdateDocLink } from '@/features/docs/doc-share/api/useUpdateDocLink';
import { useSkeletonStore } from '@/features/skeletons';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { setIsSkeletonVisible } = useSkeletonStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkReach = searchParams.get('link-reach');
  const linkRole = searchParams.get('link-role');
  const title = searchParams.get('title');
  const peoplesharing = searchParams.get('peoplesharing');

  const {
    mutate: createDoc,
    //isSuccess: isDocCreated,
    data: doc,
  } = useCreateDoc({
    onSuccess: (doc) => {
      if ((linkReach && linkRole) || linkReach || peoplesharing) {
        return;
      }

      redirectToDoc(doc.id);
    },
    onError: () => {},
  });

  const { mutate: updateDocLink } = useUpdateDocLink({
    onSuccess: (response, params) => {
      if (peoplesharing || !params.id) {
        return;
      }

      redirectToDoc(params.id);
    },
    onError: (error, params) => {
      captureException(error, {
        extra: {
          docId: params.id,
          linkReach,
          linkRole,
        },
      });

      if (params.id) {
        redirectToDoc(params.id);
      }
    },
  });

  const redirectToDoc = useCallback(
    (docId: string) => {
      void router.push(`/docs/${docId}`);
    },
    [router],
  );

  useEffect(() => {
    setIsSkeletonVisible(true);
  }, [setIsSkeletonVisible]);

  // Doc creation effect
  useEffect(() => {
    if (doc) {
      return;
    }

    createDoc({
      title: title || undefined,
    });
  }, [createDoc, doc, title]);

  useEffect(() => {
    if (!linkReach || !doc) {
      return;
    }

    updateDocLink({
      id: doc.id,
      link_reach: linkReach as LinkReach,
      link_role: (linkRole as LinkRole | undefined) || undefined,
    });
  }, [linkReach, doc, updateDocLink, redirectToDoc, linkRole]);

  if (!linkReach && linkRole) {
    console.warn('link-reach parameter is missing');
  }

  return <Loading />;
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
