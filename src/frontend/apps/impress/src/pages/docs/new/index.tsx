import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';

import { Loading } from '@/components';
import { LinkReach, useCreateDoc } from '@/features/docs/doc-management';
import { useUpdateDocLink } from '@/features/docs/doc-share/api/useUpdateDocLink';
import { useSkeletonStore } from '@/features/skeletons';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { setIsSkeletonVisible } = useSkeletonStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkReach = searchParams.get('link-reach');
  const linkTitle = searchParams.get('title');
  const linkpermission = searchParams.get('linkpermission');
  const peoplesharing = searchParams.get('peoplesharing');

  const {
    mutate: createDoc,
    //isSuccess: isDocCreated,
    data: doc,
  } = useCreateDoc({
    onSuccess: (doc) => {
      if (linkReach || linkpermission || peoplesharing) {
        return;
      }

      router
        .push(`/docs/${doc.id}`)
        .then(() => {})
        .catch(() => {});
    },
    onError: () => {},
  });

  const { mutate: updateDocLink } = useUpdateDocLink();

  useEffect(() => {
    setIsSkeletonVisible(true);
  }, [setIsSkeletonVisible]);

  useEffect(() => {
    if (doc) {
      return;
    }

    createDoc();
  }, [createDoc, doc]);

  useEffect(() => {
    if (!linkReach || !doc) {
      return;
    }

    console.log('linkReach', linkReach);

    if (!Object.values(LinkReach).includes(linkReach as LinkReach)) {
      throw new Error('Invalid link reach value');
    }

    updateDocLink({
      id: doc.id,
      link_reach: linkReach as LinkReach,
      //link_role: linkRole,
    });
  }, [linkReach, doc, updateDocLink]);

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
