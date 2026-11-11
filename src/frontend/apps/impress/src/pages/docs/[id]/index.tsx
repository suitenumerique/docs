import { TreeProvider } from '@gouvfr-lasuite/ui-components';
import { useQueryClient } from '@tanstack/react-query';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { DocFloatingBar } from '@/docs/doc-header/components/DocFloatingBar';
import {
  Doc,
  DocPage403,
  KEY_DOC,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management/';
import {
  getPublicDoc,
  getPublicDocExcerpt,
  getPublicOrigin,
} from '@/docs/doc-meta/server';
import { KEY_AUTH, setAuthUrl, useAuth } from '@/features/auth';
import { PresenterRoot } from '@/features/docs/doc-presenter';
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
    query: { id: queryId },
    asPath,
  } = useRouter();

  // Offline, the service worker answers any doc with the `/docs/[id]/` shell,
  // whose server-side props carry `[id]`: read the id from the URL instead
  const id = queryId === '[id]' ? asPath.split(/[/?#]/)[2] : queryId;

  if (typeof id !== 'string' || !id) {
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
          <DocFloatingBar />
          <DocPage id={id} />
        </MainLayout>
        <PresenterRoot />
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
          {doc.title || untitledDocument} -{' '}
          {t('Docs', {
            description: 'Product name, shown in page titles and the logo',
          })}
        </title>
        <meta
          property="og:title"
          content={`${doc.title || untitledDocument} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}
          key="title"
        />
      </Head>
      <DocEditor doc={doc} />
    </>
  );
};

interface PageProps {
  // Set when the doc is public, for link previews
  meta?: DocMeta;
}

interface DocMeta {
  // `''` when the doc has no title or no text
  title: string;
  description: string;
  url: string;
  image: string;
}

/**
 * Link previews (Mattermost, Slack, social networks) don't run JavaScript:
 * render the title, start and preview image of a public doc in the HTML sent
 * by the server. Restricted and connected-only docs keep the generic tags.
 */
export const getServerSideProps: GetServerSideProps<PageProps> = async ({
  params,
  req,
}) => {
  const id = params?.id;

  // Client-side navigations fetch these props as JSON and have no use for them
  if (typeof id !== 'string' || req.url?.startsWith('/_next/data/')) {
    return { props: {} };
  }

  const doc = await getPublicDoc(req, id);
  if (!doc) {
    return { props: {} };
  }

  const url = `${getPublicOrigin(req)}/docs/${id}/`;

  return {
    props: {
      meta: {
        title: doc.title || '',
        description: await getPublicDocExcerpt(req, doc),
        url,
        image: `${url}preview.png`,
      },
    },
  };
};

const DocMetaHead = ({ meta }: { meta: DocMeta }) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();

  const productName = t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  });
  const title = `${meta.title || untitledDocument} - ${productName}`;

  return (
    <Head>
      <title>{title}</title>
      <meta property="og:title" content={title} key="title" />
      <meta property="og:site_name" content={productName} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={meta.url} />
      <meta property="og:image" content={meta.image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      {meta.description && (
        <>
          <meta
            name="description"
            content={meta.description}
            key="description"
          />
          <meta property="og:description" content={meta.description} />
        </>
      )}
    </Head>
  );
};

const Page: NextPageWithLayout<PageProps> = () => {
  return null;
};

Page.getLayout = function getLayout() {
  return <DocLayout />;
};

// Rendered by `_app` outside the providers, which wait for the config on the
// client: the server would otherwise render none of it
Page.getHead = function getHead({ meta }) {
  return meta ? <DocMetaHead meta={meta} /> : null;
};

export default Page;
