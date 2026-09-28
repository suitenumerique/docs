import { Button, TreeProvider } from '@gouvfr-lasuite/ui-components';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, Loading, StyledLink } from '@/components';
import { DEFAULT_QUERY_RETRY } from '@/core';
import { useCollaboration } from '@/docs/doc-editor/hook/useCollaboration';
import { DocFloatingBar } from '@/docs/doc-header/components/DocFloatingBar';
import {
  Doc,
  DocPage403,
  KEY_DOC,
  useDoc,
  useDocStore,
  useEncryptionAccessCopy,
  useProviderStore,
  useTrans,
} from '@/docs/doc-management/';
import { KEY_DOC_CONTENT } from '@/docs/doc-management/api/useDocContent';
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
import { DecryptionFailurePanel } from '@/features/docs/doc-management/components/DecryptionFailurePanel';
import { EncryptionEmptyState } from '@/features/docs/doc-management/components/EncryptionLayout';
import { PresenterRoot } from '@/features/docs/doc-presenter';
import { useAutoAcceptPendingMembers } from '@/features/docs/doc-share';
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
  const {
    encryptionTransition,
    clearEncryptionTransition,
    provider,
    decryptionFailure,
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
      staleTime: 30000, // 30 seconds - We keep the data fresh as it is a highly collaborative page
      queryKey: [KEY_DOC, { id }],
      retryDelay: 1000,
      // A pending member is let in by an owner opening the document elsewhere:
      // look again now and then so the page opens by itself once they have.
      refetchInterval: (query) =>
        query.state.data?.is_pending_encryption_for_user ? 15_000 : false,
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
  const { authenticated, user } = useAuth();
  const { untitledDocument } = useTrans();
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
    doc?.is_pending_encryption_for_user,
  );
  const needsSetup =
    encryptionError === 'missing_private_key' ||
    encryptionError === 'missing_public_key';
  const accessCopy = useEncryptionAccessCopy(doc, needsSetup);
  // Only once the content decrypted: the key then provably opens.
  useAutoAcceptPendingMembers(
    doc,
    provider ? documentEncryptionSettings : null,
  );
  // Held by the page rather than the editor, so the provider state survives
  // the transition and decryption failure screens that replace the editor
  useCollaboration(doc?.id, doc?.is_encrypted, documentEncryptionSettings);

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

  // when encryption transition destroys the provider, that's the signal to refetch the document
  useEffect(() => {
    if (encryptionTransition && !provider && doc?.id) {
      // The stored content changes form (clear or encrypted): drop the cached one
      // so the next provider never starts from the previous form
      queryClient.removeQueries({
        queryKey: [KEY_DOC_CONTENT, { id: doc.id }],
      });
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

  if (!doc || encryptionLoading || documentEncryptionLoading) {
    return <Loading />;
  }

  if (doc.is_encrypted && decryptionFailure) {
    return <DecryptionFailurePanel failure={decryptionFailure} />;
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
    return (
      <>
        <EncryptionEmptyState
          title={accessCopy.title}
          description={accessCopy.description}
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
