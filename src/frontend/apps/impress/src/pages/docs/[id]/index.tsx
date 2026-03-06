import { TreeProvider } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@gouvfr-lasuite/cunningham-react';
import { Spinner } from '@gouvfr-lasuite/ui-kit';

import { Box, Icon, Loading, StyledLink, Text, TextErrors } from '@/components';
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
  useTrans,
} from '@/docs/doc-management/';
import { KEY_AUTH, setAuthUrl, useAuth } from '@/features/auth';
import {
  useDocumentEncryption,
  useUserEncryption,
} from '@/features/docs/doc-collaboration';
import { getDocChildren, subPageToTree } from '@/features/docs/doc-tree/';
import { useSkeletonStore } from '@/features/skeletons';
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
        onLoadChildren={async (docId: string, page: number) => {
          const doc = await getDocChildren({ docId, page });
          return {
            children: subPageToTree(doc.results),
            hasMore: !!doc.next,
          };
        }}
      >
        <MainLayout enableResizablePanel={true}>
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
  const {
    hasLostConnection,
    resetLostConnection,
    encryptionTransition,
    clearEncryptionTransition,
    provider,
  } = useProviderStore();
  const { isSkeletonVisible, setIsSkeletonVisible } = useSkeletonStore();
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

  const { authenticated } = useAuth();
  const [doc, setDoc] = useState<Doc>();
  const { encryptionLoading, encryptionError } = useUserEncryption();
  const {
    documentEncryptionLoading,
    documentEncryptionSettings,
    documentEncryptionError,
  } = useDocumentEncryption(
    doc?.is_encrypted,
    doc?.encrypted_document_symmetric_key_for_user,
  );
  const { setCurrentDoc } = useDocStore();
  const { addTask } = useBroadcastStore();
  const queryClient = useQueryClient();
  const { replace } = useRouter();
  useCollaboration(
    doc?.id,
    doc?.content,
    doc?.is_encrypted,
    documentEncryptionSettings,
  );
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();

  /**
   * Show skeleton when loading a document
   */
  useEffect(() => {
    if (
      !doc &&
      encryptionLoading &&
      documentEncryptionLoading &&
      !isError &&
      !isSkeletonVisible
    ) {
      setIsSkeletonVisible(true);
    }

    if (isError) {
      setIsSkeletonVisible(false);
    }
  }, [
    doc,
    encryptionLoading,
    documentEncryptionLoading,
    isError,
    isSkeletonVisible,
    setIsSkeletonVisible,
  ]);

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
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: doc.id }],
      });
      resetLostConnection();
    }
  }, [hasLostConnection, doc?.id, queryClient, resetLostConnection]);

  // when encryption transition destroys the provider, that's the signal to refetch the document
  useEffect(() => {
    if (encryptionTransition && !provider && doc?.id) {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: doc.id }],
      });
    }
  }, [encryptionTransition, provider, doc?.id, queryClient]);

  // clear transition state once the doc has been refetched with updated state
  // and encryption settings are resolved (derived or cleared), unblocking useCollaboration()
  useEffect(() => {
    if (!encryptionTransition || provider) {
      return;
    }

    // this boolean check ensure the new document data has been properly fetch compared to the old data
    const docUpdated =
      encryptionTransition === 'encrypting'
        ? doc?.is_encrypted === true
        : doc?.is_encrypted === false;

    if (docUpdated && !documentEncryptionLoading) {
      clearEncryptionTransition();
    }
  }, [
    encryptionTransition,
    provider,
    doc?.is_encrypted,
    documentEncryptionLoading,
    clearEncryptionTransition,
  ]);

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
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: doc.id }],
      });
    });
  }, [addTask, doc?.id, queryClient]);

  useEffect(() => {
    if (!isError || !error?.status || ![404, 401].includes(error.status)) {
      return;
    }

    let replacePath = `/${error.status}`;

    if (error.status === 401) {
      if (authenticated) {
        queryClient.setQueryData([KEY_AUTH], null);
      }
      setAuthUrl();
    }

    void replace(replacePath);
  }, [isError, error?.status, replace, authenticated, queryClient]);

  if (isError && error?.status) {
    if ([404, 401].includes(error.status)) {
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
              <Icon iconName="wifi_off" $theme="danger" $withThemeInherited />
            ) : undefined
          }
        />
      </Box>
    );
  }

  if (!doc || encryptionLoading || documentEncryptionLoading) {
    return <Loading />;
  }

  if (doc.is_encrypted && (encryptionError || documentEncryptionError)) {
    return (
      <Box $align="center" $margin="auto" $gap="md" $padding="2rem">
        <Icon iconName="lock" $size="3rem" $theme="warning" />
        <Text as="h2" $textAlign="center" $margin="0">
          {t('Encryption keys unavailable')}
        </Text>
        <Box $maxWidth="500px" $gap="sm">
          <Text $variation="secondary" $textAlign="center">
            {t(
              'This is an encrypted document, but your current device does not have the required encryption keys to decrypt it.',
            )}
          </Text>

          {(encryptionError === 'missing_private_key' ||
            encryptionError === 'missing_public_key') && (
            <Text $variation="secondary" $textAlign="center">
              {t(
                'This usually happens when you switch to a new device or browser without restoring your encryption backup.',
              )}
            </Text>
          )}

          {documentEncryptionError === 'missing_symmetric_key' && (
            <Text $variation="secondary" $textAlign="center">
              {t(
                'You do not have access to this encrypted document. Ask the document owner to share it with you again.',
              )}
            </Text>
          )}

          {documentEncryptionError === 'decryption_failed' && (
            <Text $variation="secondary" $textAlign="center">
              {t(
                'Your encryption keys could not decrypt this document. This may happen if your keys were recreated. Ask the document owner to share it with you again.',
              )}
            </Text>
          )}
        </Box>

        {(encryptionError === 'missing_private_key' ||
          encryptionError === 'missing_public_key') && (
          <Box $gap="xs" $maxWidth="500px">
            <Box
              $padding="sm"
              $background="#f0f7ff"
              $border="1px solid #c5ddf5"
              $radius="4px"
              $gap="xs"
            >
              <Text $weight="600" $size="sm">
                {t('Restore from backup (recommended)')}
              </Text>
              <Text $size="sm" $variation="secondary">
                {t(
                  'If you have previously exported your encryption backup, you can restore it in your account settings to regain access to all your encrypted documents.',
                )}
              </Text>
            </Box>
            <Box
              $padding="sm"
              $background="#fff8f0"
              $border="1px solid #f5dfc5"
              $radius="4px"
              $gap="xs"
            >
              <Text $weight="600" $size="sm">
                {t('Recreate encryption keys (not recommended)')}
              </Text>
              <Text $size="sm" $variation="secondary">
                {t(
                  'Creating new encryption keys means you will lose access to all previously encrypted documents. Document owners will need to share them with you again.',
                )}
              </Text>
            </Box>
          </Box>
        )}

        <StyledLink href="/">
          <Button
            color="neutral"
            icon={<Icon iconName="home" $withThemeInherited />}
          >
            {t('Back to home')}
          </Button>
        </StyledLink>
      </Box>
    );
  }

  if (encryptionTransition) {
    return (
      <Box
        $align="center"
        $justify="center"
        $height="100%"
        $width="100%"
        $gap="md"
      >
        <Spinner />
        <Text $textAlign="center" $variation="secondary">
          {encryptionTransition === 'encrypting'
            ? t('Document encryption in progress, please wait...')
            : t('Removing document encryption, please wait...')}
        </Text>
      </Box>
    );
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
      <DocEditor
        doc={doc}
        documentEncryptionSettings={documentEncryptionSettings}
      />
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
