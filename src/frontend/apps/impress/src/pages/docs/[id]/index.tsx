import { TreeProvider } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Loading, TextErrors } from '@/components';
import { DEFAULT_QUERY_RETRY } from '@/core';
import { DocEditor } from '@/docs/doc-editor';
import {
  Doc,
  DocPage403,
  KEY_DOC,
  useCollaboration,
  useDoc,
  useDocStore,
  useProviderStore,
} from '@/docs/doc-management/';
import { KEY_AUTH, setAuthUrl, useAuth } from '@/features/auth';
import { getDocChildren, subPageToTree } from '@/features/docs/doc-tree/';
import { MainLayout } from '@/layouts';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useBroadcastStore } from '@/stores';
import { NextPageWithLayout } from '@/types/next';

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
        onLoadChildren={async (docId: string) => {
          const doc = await getDocChildren({ docId });
          return subPageToTree(doc.results);
        }}
      >
        <MainLayout>
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
  const { hasLostConnection, resetLostConnection } = useProviderStore();
  const {
    data: docQuery,
    isError,
    isFetching,
    error,
  } = useDoc(
    { id },
    {
      staleTime: 0,
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
  const { addTask } = useBroadcastStore();
  const queryClient = useQueryClient();
  const { replace } = useRouter();
  useCollaboration(doc?.id, doc?.content);
  const { t } = useTranslation();
  const { authenticated } = useAuth();

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

  // Invalidate when provider store reports a lost connection
  useEffect(() => {
    if (hasLostConnection && doc?.id) {
      queryClient.invalidateQueries({ queryKey: [KEY_DOC, { id: doc.id }] });
      resetLostConnection();
    }
  }, [hasLostConnection, doc?.id, queryClient, resetLostConnection]);

  useEffect(() => {
    if (!docQuery || isFetching) {
      return;
    }

    setDoc(docQuery);
    setCurrentDoc(docQuery);
  }, [docQuery, setCurrentDoc, isFetching]);

  useEffect(() => {
    return () => {
      setCurrentDoc(undefined);
    };
  }, [setCurrentDoc]);

  /**
   * We add a broadcast task to reset the query cache
   * when the document visibility changes.
   */
  useEffect(() => {
    if (!doc?.id) {
      return;
    }

    addTask(`${KEY_DOC}-${doc.id}`, () => {
      void queryClient.resetQueries({
        queryKey: [KEY_DOC, { id: doc.id }],
      });
    });
  }, [addTask, doc?.id, queryClient]);

  if (isError && error) {
    if ([404, 401].includes(error.status)) {
      let replacePath = `/${error.status}`;

      if (error.status === 401) {
        if (authenticated) {
          queryClient.setQueryData([KEY_AUTH], {
            user: null,
            authenticated: false,
          });
        }
        setAuthUrl();
      }

      void replace(replacePath);

      return <Loading />;
    }

    if (error.status === 403) {
      return <DocPage403 id={id} />;
    }

    return (
      <Box $margin="large">
        <TextErrors
          causes={error.cause}
          icon={
            error.status === 502 ? (
              <Icon iconName="wifi_off" $theme="danger" $variation="600" />
            ) : undefined
          }
        />
      </Box>
    );
  }

  if (!doc) {
    return <Loading />;
  }

  return (
    <>
      <Head>
        <title>
          {doc.title} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${doc.title} - ${t('Docs')}`}
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
