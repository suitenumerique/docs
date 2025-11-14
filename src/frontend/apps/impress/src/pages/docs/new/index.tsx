import { captureException } from '@sentry/nextjs';
import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { ReactElement, useCallback, useEffect } from 'react';

import { Loading } from '@/components';
import {
  LinkReach,
  LinkRole,
  Role,
  useCreateDoc,
} from '@/features/docs/doc-management';
import {
  KEY_LIST_USER,
  getUsers,
  useCreateDocAccess,
  useCreateDocInvitation,
  useDocAccesses,
  useUsers,
} from '@/features/docs/doc-share';
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
  const members = searchParams.get('members');
  const { mutateAsync: createInvitation } = useCreateDocInvitation();
  const { mutateAsync: createDocAccess } = useCreateDocAccess();

  const {
    mutate: createDoc,
    //isSuccess: isDocCreated,
    data: doc,
  } = useCreateDoc({
    onSuccess: (doc) => {
      if ((linkReach && linkRole) || linkReach || members) {
        return;
      }

      redirectToDoc(doc.id);
    },
    onError: () => {},
  });

  const { mutate: updateDocLink } = useUpdateDocLink({
    onSuccess: (_, params) => {
      if (members || !params.id) {
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

  // Doc link update effect
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

  // const onInvite = async () => {
  //   setIsLoading(true);
  //   const promises = selectedUsers.map((user) => {
  //     const isInvitationMode = user.id === user.email;

  //     const payload = {
  //       role: invitationRole,
  //       docId: doc.id,
  //     };

  //     return isInvitationMode
  //       ? createInvitation({
  //           ...payload,
  //           email: user.email.toLowerCase(),
  //         })
  //       : createDocAccess({
  //           ...payload,
  //           memberId: user.id,
  //         });
  //   });

  //   const settledPromises = await Promise.allSettled(promises);
  //   settledPromises.forEach((settledPromise) => {
  //     if (settledPromise.status === 'rejected') {
  //       onError(settledPromise.reason as APIErrorUser);
  //     }
  //   });
  //   afterInvite?.();
  //   setIsLoading(false);
  // };

  // members=user%40example.org%2Ceditor%7Cuser2%40example.org%2Creader
  // members=user@example.org,editor|user2@example.org,reader
  useEffect(() => {
    if (!members || !doc) {
      return;
    }

    console.log('members', members);
    const membersList = members.split('|').map((memberStr) => {
      const [email, role] = memberStr.split(',');
      return { email, role: role as Role };
    });

    console.log('membersList', membersList);

    for (const member of membersList) {
      getUsers({
        query: member.email,
        docId: doc.id,
      })
        .then((users) => {
          if (users.length > 0) {
            console.log('User exists:', users);
            // User exists, create doc access
            // createDocAccess({
            //   role: member.role,
            //   docId: doc.id,
            //   memberId: users[0].id,
            // }).catch(() => {
            //   // Ignore errors
            // });
          } else {
            console.log('User does not exist:', {
              role: member.role,
              docId: doc.id,
              email: member.email.toLowerCase(),
            });
            // User does not exist, create invitation
            // createInvitation({
            //   role: member.role,
            //   docId: doc.id,
            //   email: member.email.toLowerCase(),
            // }).catch(() => {
            //   // Ignore errors
            // });
          }
        })
        .catch(() => {
          // Ignore errors
        });

      // const isInvitationMode = !member.email.match(
      //   /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      // );

      // const payload = {
      //   role: member.role,
      //   docId: doc.id,
      // };

      // if (isInvitationMode) {
      //   createInvitation({
      //     ...payload,
      //     email: member.email.toLowerCase(),
      //   }).catch(() => {
      //     // Ignore errors
      //   });
      // } else {
      //   createDocAccess({
      //     ...payload,
      //     memberId: member.email,
      //   }).catch(() => {
      //     // Ignore errors
      //   });
      // }
    }

    //redirectToDoc(doc.id);

    //getUsers
  }, [createDocAccess, createInvitation, doc, members]);

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
