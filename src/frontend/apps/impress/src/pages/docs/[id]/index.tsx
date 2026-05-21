import { TreeProvider } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { DEFAULT_QUERY_RETRY } from '@/core';
import {
  Doc,
  DocPage403,
  KEY_DOC,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management/';
import { KEY_AUTH, setAuthUrl, useAuth } from '@/features/auth';
import { FloatingBar } from '@/features/docs/doc-header/components/FloatingBar';
import { getDocChildren, subPageToTree } from '@/features/docs/doc-tree/';
import { DocEditorSkeleton, useSkeletonStore } from '@/features/skeletons';
import { MainLayout } from '@/layouts';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { NextPageWithLayout } from '@/types/next';

const DocEditor = dynamic(
  () =>
    import('@/docs/doc-editor/components/DocEditor').then((mod) => ({
      default: mod.DocEditor,
    })),
  {
    ssr: false,
    loading: () => <DocEditorSkeleton />,
  },
);

export function DocLayout() {
  const {
    query: { id },
  } = useRouter();

  if (typeof id !== 'string') {
    return null;
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <TreeProvider
        initialNodeId={id}
        onLoadChildren={async (docId: string, page: number) => {
          const doc = await getDocChildren({ docId, page });
          return {
            children: subPageToTree(doc.results),
            pagination: {
              currentPage: page,
              hasMore: !!doc.next,
              totalCount: doc.count,
            },
          };
        }}
      >
        <MainLayout enableResizablePanel={true}>
          <FloatingBar />
          <DocPage id={id} />
        </MainLayout>
      </TreeProvider>
    </>
  );
}

interface DocProps {
  id: string;
}

const DocPage = ({ id }: DocProps) => {
  const { isSkeletonVisible, setIsSkeletonVisible } = useSkeletonStore();
  const {
    data: docQuery,
    isError,
    isFetching,
    error,
  } = useDoc(
    { id },
    {
      staleTime: 30000, // 30 seconds - We keep the data fresh as it is a highly collaborative page
      queryKey: [KEY_DOC, { id }],
      retryDelay: 1000,
      retry: (failureCount, error) => {
        if (error.status == 403 || error.status == 401 || error.status == 404) {
          return false;
        } else {
          return failureCount < DEFAULT_QUERY_RETRY;
        }
      },
    },
  );

  const [doc, setDoc] = useState<Doc>();
  const { setCurrentDoc } = useDocStore();
  const queryClient = useQueryClient();
  const { replace, asPath } = useRouter();
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { untitledDocument } = useTrans();

  /**
   * Show skeleton when loading a document
   */
  useEffect(() => {
    if (!doc && !isError && !isSkeletonVisible) {
      setIsSkeletonVisible(true);
    }

    if (isError) {
      setIsSkeletonVisible(false);
    }
  }, [doc, isError, isSkeletonVisible, setIsSkeletonVisible]);

  /**
   * Scroll to top when navigating to a new document
   * We use a timeout to ensure the scroll happens after the layout has updated.
   */
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    const mainElement = document.getElementById(MAIN_LAYOUT_ID);
    if (mainElement) {
      timeoutId = setTimeout(() => {
        mainElement.scrollTop = 0;
      }, 150);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [id]);

  useEffect(() => {
    if (!docQuery || isFetching) {
      return;
    }

    setDoc(docQuery);
    setCurrentDoc(docQuery);
  }, [docQuery, setCurrentDoc, isFetching]);

  /**
   * Reset state when unmounting the component to avoid
   * showing stale data when navigating to another document
   */
  useEffect(() => {
    return () => {
      setCurrentDoc(undefined);
      setIsSkeletonVisible(false);
    };
  }, [setCurrentDoc, setIsSkeletonVisible]);

  useEffect(() => {
    if (!isError || !error?.status || [403].includes(error.status)) {
      return;
    }

    if (error.status === 401) {
      if (authenticated) {
        queryClient.setQueryData([KEY_AUTH], null);
      }
      setAuthUrl();
      void replace('/401');
      return;
    }

    if (error.status === 404) {
      void replace('/404');
      return;
    }

    if (error.status === 502) {
      void replace('/offline');
      return;
    }

    const fromPath = encodeURIComponent(asPath);
    void replace(`/500?from=${fromPath}`);
  }, [isError, error?.status, replace, authenticated, queryClient, asPath]);

  if (isError && error?.status) {
    if (error.status === 403) {
      return <DocPage403 id={id} />;
    }

    return <Loading />;
  }

  if (!doc) {
    return <Loading />;
  }

  return (
    <>
      <Head>
        <title>
          {doc.title || untitledDocument} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${doc.title || untitledDocument} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <DocEditor doc={doc} />
    </>
  );
};

const Page: NextPageWithLayout = () => {
  return null;
};

Page.getLayout = function getLayout() {
  return <DocLayout />;
};

export default Page;
