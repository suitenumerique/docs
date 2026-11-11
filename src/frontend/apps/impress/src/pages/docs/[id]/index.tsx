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
  LinkReach,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management/';
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
  // Title of a public doc, `''` when it has none
  publicTitle?: string;
}

/**
 * GET a JSON document, `null` on any other answer. `fetch` silently drops a
 * `Host` header, so this goes through `node:http`.
 */
const getJson = async <T,>(
  url: string,
  headers: Record<string, string>,
): Promise<T | null> => {
  const { request } = url.startsWith('https:')
    ? await import('node:https')
    : await import('node:http');

  return new Promise((resolve) => {
    const req = request(url, { headers, timeout: 2000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Link previews (Mattermost, Slack, social networks) don't run JavaScript:
 * render the title of a public doc in the HTML sent by the server. The doc is
 * fetched without the visitor's cookies, so a restricted or connected-only doc
 * never leaks its title, it keeps the generic tags.
 */
export const getServerSideProps: GetServerSideProps<PageProps> = async ({
  params,
  req,
}) => {
  const id = params?.id;
  const backendUrl = process.env.BACKEND_BASE_URL;

  // Client-side navigations fetch these props as JSON and have no use for them
  if (
    !backendUrl ||
    typeof id !== 'string' ||
    !UUID_REGEX.test(id) ||
    req.url?.startsWith('/_next/data/')
  ) {
    return { props: {} };
  }

  // In production the backend only accepts its public host (ALLOWED_HOSTS) and
  // redirects plain http to https. Pass on the public host, the first one when
  // proxies are chained, and always claim https: Next.js sets
  // `x-forwarded-proto: http` when the proxy sends none, and this request
  // carries no credentials.
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Forwarded-Proto': 'https',
  };
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host)
    ?.toString()
    .split(',')[0]
    .trim();
  if (host) {
    headers.Host = host;
  }

  try {
    const doc = await getJson<Doc>(
      `${backendUrl}/api/v1.0/documents/${id}/`,
      headers,
    );
    if (doc?.computed_link_reach !== LinkReach.PUBLIC) {
      return { props: {} };
    }

    return { props: { publicTitle: doc.title || '' } };
  } catch {
    return { props: {} };
  }
};

const DocMetaHead = ({ docTitle }: { docTitle: string }) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();

  const title = `${docTitle || untitledDocument} - ${t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  })}`;

  return (
    <Head>
      <title>{title}</title>
      <meta property="og:title" content={title} key="title" />
      <meta property="og:type" content="article" />
      <meta name="twitter:card" content="summary" />
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
Page.getHead = function getHead({ publicTitle }) {
  return publicTitle !== undefined ? (
    <DocMetaHead docTitle={publicTitle} />
  ) : null;
};

export default Page;
