import { Button } from '@gouvfr-lasuite/cunningham-react';
import { TreeProvider } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Loading, StyledLink, TextErrors } from '@/components';
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
import {
  KEY_AUTH,
  ModalEncryptionOnboarding,
  setAuthUrl,
  useAuth,
} from '@/features/auth';
import {
  useDocumentEncryption,
  useUserEncryption,
} from '@/features/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { EncryptionEmptyState } from '@/features/docs/doc-management/components/EncryptionLayout';
import { KeyMismatchPanel } from '@/features/docs/doc-management/components/KeyMismatchPanel';
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
    decryptionFailed,
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

  const { authenticated, user } = useAuth();
  const [doc, setDoc] = useState<Doc>();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const { isEnabled: isEncryptionEnabled, error: vaultClientError } =
    useVaultClient();
  const { encryptionLoading, encryptionError } = useUserEncryption();
  const {
    documentEncryptionLoading,
    documentEncryptionSettings,
    documentEncryptionError,
  } = useDocumentEncryption(
    doc?.is_encrypted,
    doc?.encrypted_document_symmetric_key_for_user,
    user?.suite_user_id
      ? doc?.accesses_versions_per_user?.[user.suite_user_id]
      : undefined,
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

  if (doc.is_encrypted && decryptionFailed) {
    return <KeyMismatchPanel doc={doc} />;
  }

  if (doc.is_encrypted && vaultClientError) {
    return (
      <EncryptionEmptyState
        title={t('Encryption service unavailable')}
        description={t(
          'This document is encrypted and the encryption service could not be loaded. Check your connection and try again.',
        )}
        actions={
          <>
            <StyledLink href="/">
              <Button
                size="small"
                color="neutral"
                variant="tertiary"
                icon={<Icon iconName="home" $withThemeInherited />}
              >
                {t('Home')}
              </Button>
            </StyledLink>
            <Button
              size="small"
              variant="tertiary"
              onClick={() => window.location.reload()}
              icon={<Icon iconName="refresh" $withThemeInherited />}
            >
              {t('Retry')}
            </Button>
          </>
        }
      />
    );
  }

  if (doc.is_encrypted && (encryptionError || documentEncryptionError)) {
    const needsSetup =
      encryptionError === 'missing_private_key' ||
      encryptionError === 'missing_public_key';

    return (
      <>
        <EncryptionEmptyState
          title={t('Encrypted document')}
          description={
            needsSetup
              ? t(
                  'This document is encrypted. You must enable encryption on your account to access it.',
                )
              : documentEncryptionError === 'missing_symmetric_key'
                ? t(
                    'You do not have access to this encrypted document. Ask the document owner to share it with you again.',
                  )
                : t(
                    'You do not have the correct encryption key to decrypt this document. Ask the document owner to share it with you again.',
                  )
          }
          actions={
            <>
              <StyledLink href="/">
                <Button
                  size="small"
                  color="neutral"
                  variant="tertiary"
                  icon={<Icon iconName="home" $withThemeInherited />}
                >
                  {t('Home')}
                </Button>
              </StyledLink>
              {needsSetup && isEncryptionEnabled && (
                <Button
                  size="small"
                  variant="tertiary"
                  onClick={() => setIsOnboardingOpen(true)}
                  icon={<Icon iconName="verified_user" $withThemeInherited />}
                >
                  {t('Enable encryption')}
                </Button>
              )}
            </>
          }
        />
        {isOnboardingOpen && (
          <ModalEncryptionOnboarding
            isOpen
            onClose={() => setIsOnboardingOpen(false)}
            onSuccess={() => setIsOnboardingOpen(false)}
          />
        )}
      </>
    );
  }

  if (encryptionTransition) {
    return (
      <EncryptionEmptyState
        illustration="document-encrypting"
        title={
          encryptionTransition === 'encrypting'
            ? t('Encryption in progress')
            : t('Removing encryption')
        }
        description={
          encryptionTransition === 'encrypting'
            ? t('The document owner is encrypting this document. Please wait.')
            : t(
                'The document owner is removing encryption from this document. Please wait.',
              )
        }
      />
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
