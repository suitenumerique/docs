import {
  Button,
  ButtonProps,
  VariantType,
} from '@gouvfr-lasuite/ui-components';
import { MouseEventHandler, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import {
  Box,
  BoxButton,
  HorizontalSeparator,
  Icon,
  LoadMoreText,
  Loading,
  Text,
} from '@/components';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { AccessRequest, Doc, Role } from '@/docs/doc-management/';
import { useAuth } from '@/features/auth';
import { useToast } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import {
  useAcceptDocAccessRequest,
  useCreateDocAccessRequest,
  useDeleteDocAccessRequest,
  useDocAccessRequests,
  useDocAccessRequestsInfinite,
} from '../api/useDocAccessRequest';

import { DocRoleDropdown } from './DocRoleDropdown';
import { SearchUserRow } from './SearchUserRow';

const QuickSearchGroupAccessRequestStyle = createGlobalStyle`
  .quick-search-container .--docs--share-access-request [cmdk-item]:hover, 
  .quick-search-container .--docs--share-access-request [cmdk-item][data-selected='true'] {
      background: inherit;
  }
  .--docs--doc-share-access-request-item:hover {
    background: var(--c--contextuals--background--semantic--contextual--primary);
  }
`;

type Props = {
  doc: Doc;
  accessRequest: AccessRequest;
};

const DocShareAccessRequestItem = ({ doc, accessRequest }: Props) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();
  const { toast } = useToast();
  const { spacingsTokens } = useCunninghamTheme();
  const { mutate: acceptDocAccessRequests } = useAcceptDocAccessRequest();
  const [role, setRole] = useState(accessRequest.role);

  const { mutate: removeDocAccess } = useDeleteDocAccessRequest({
    onError: () => {
      toast(
        t('Error while removing the request.', {
          description: 'Toast shown when deleting an access request failed',
        }),
        VariantType.ERROR,
        {
          duration: 4000,
        },
      );
    },
  });

  if (!doc.abilities.accesses_view) {
    return null;
  }

  return (
    <Box
      $width="100%"
      data-testid={`doc-share-access-request-row-${accessRequest.user.email}`}
      className="--docs--doc-share-access-request-item"
      $css={css`
        & .--docs--quick-search-item-content {
          flex-wrap: wrap;

          .--docs--quick-search-item-content-right {
            margin-left: auto;
          }
        }
      `}
    >
      <SearchUserRow
        alwaysShowRight={true}
        user={accessRequest.user}
        right={
          <Box $direction="row" $align="center" $gap={spacingsTokens['sm']}>
            <DocRoleDropdown
              currentRole={role}
              onSelectRole={setRole}
              canUpdate={doc.abilities.accesses_manage}
              rolesAllowed={accessRequest.abilities.set_role_to}
              ariaLabel={t('Change role for {{name}}', {
                description: 'Accessible name of the role dropdown of a member',
                name: accessRequest.user.full_name || accessRequest.user.email,
              })}
            />
            <Button
              color="brand"
              variant="secondary"
              onClick={() =>
                acceptDocAccessRequests({
                  docId: doc.id,
                  accessRequestId: accessRequest.id,
                  role,
                })
              }
              size={isSmallMobile ? 'nano' : 'small'}
            >
              {t('Approve', {
                description: 'Button to accept an access request',
              })}
            </Button>

            {doc.abilities.accesses_manage && (
              <BoxButton
                onClick={() =>
                  removeDocAccess({
                    accessRequestId: accessRequest.id,
                    docId: doc.id,
                  })
                }
                aria-label={t('Close the access request modal', {
                  description:
                    'Accessible name of the button closing the access request dialog',
                })}
              >
                <Icon iconName="close" $size="16px" />
              </BoxButton>
            )}
          </Box>
        }
      />
    </Box>
  );
};

interface QuickSearchGroupAccessRequestProps {
  doc: Doc;
}

export const QuickSearchGroupAccessRequest = ({
  doc,
}: QuickSearchGroupAccessRequestProps) => {
  const { t } = useTranslation();
  const accessRequestQuery = useDocAccessRequestsInfinite({ docId: doc.id });

  const accessRequestsData: QuickSearchData<AccessRequest> = useMemo(() => {
    const accessRequests =
      accessRequestQuery.data?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: t('Access Requests', {
        description: 'Heading of the list of pending access requests',
      }),
      elements: accessRequests,
      endActions: accessRequestQuery.hasNextPage
        ? [
            {
              content: <LoadMoreText data-testid="load-more-requests" />,
              onSelect: () => void accessRequestQuery.fetchNextPage(),
            },
          ]
        : undefined,
    };
  }, [accessRequestQuery, t]);

  if (!accessRequestsData.elements.length) {
    return null;
  }

  return (
    <>
      <Box
        aria-label={t('List request access card', {
          description: 'Accessible name of the list of access requests',
        })}
        className="--docs--share-access-request"
        $padding={{ horizontal: 'base' }}
      >
        <QuickSearchGroupAccessRequestStyle />
        <QuickSearchGroup
          group={accessRequestsData}
          renderElement={(accessRequest) => (
            <DocShareAccessRequestItem
              doc={doc}
              accessRequest={accessRequest}
            />
          )}
        />
      </Box>
      <HorizontalSeparator $margin={{ vertical: 'sm' }} />
    </>
  );
};

type ButtonAccessRequestProps = {
  docId: Doc['id'];
} & Omit<ButtonProps, 'onClick'> & {
    onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  };

export const ButtonAccessRequest = ({
  docId,
  onClick,
  ...buttonProps
}: ButtonAccessRequestProps) => {
  const { authenticated } = useAuth();
  const {
    data: requests,
    error: docAccessError,
    isLoading,
  } = useDocAccessRequests({
    docId,
    page: 1,
  });
  const { t } = useTranslation();
  const { toast } = useToast();
  const { mutate: createRequest } = useCreateDocAccessRequest({
    onSuccess: () => {
      toast(
        t('Access request sent successfully.', {
          description: 'Toast shown after requesting access',
        }),
        VariantType.SUCCESS,
        {
          duration: 3000,
        },
      );
    },
  });

  if (!authenticated) {
    return null;
  }

  if (docAccessError?.status === 404) {
    return (
      <Text $maxWidth="320px" $textAlign="center" $size="sm">
        {t(
          'As this is a sub-document, please request access to the parent document to enable these features.',
          {
            description:
              'Message in the share dialog when the user lacks rights on a sub-doc',
          },
        )}
      </Text>
    );
  }

  if (isLoading) {
    return <Loading $height="auto" />;
  }

  const hasRequested = !!(
    requests && requests?.results.find((request) => request.document === docId)
  );

  return (
    <Button
      onClick={(e) => {
        createRequest({ docId, role: Role.EDITOR });
        onClick?.(e);
      }}
      disabled={hasRequested}
      {...buttonProps}
    >
      {buttonProps.children ||
        t('Request access', {
          description: 'Button to ask the owners for access to a document',
        })}
    </Button>
  );
};
