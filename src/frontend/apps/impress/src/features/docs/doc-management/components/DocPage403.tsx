import Head from 'next/head';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import ErrorAccessDeniedSvg from '@/assets/icons/Docs Locked.svg';
import {
  Box,
  ErrorActionLinkStyled,
  Loading,
  Text,
  errorActionStyles,
  errorDescriptionStyles,
} from '@/components';
import { Role } from '@/docs/doc-management';
import {
  useCreateDocAccessRequest,
  useDocAccessRequests,
} from '@/docs/doc-share/api/useDocAccessRequest';
import { useSkeletonStore } from '@/features/skeletons';
import BubbleTextSvg from '@/icons/bubble-text.svg';
import HomeSvg from '@/icons/house-rounded.svg';

const RequestAccessButton = styled.button`
  ${errorActionStyles}
  color: var(--c--contextuals--content--semantic--brand--tertiary);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface DocProps {
  id: string;
}

export const DocPage403 = ({ id }: DocProps) => {
  const { t } = useTranslation();
  const { setIsSkeletonVisible } = useSkeletonStore();

  useEffect(() => {
    // Ensure the skeleton overlay is hidden on 403 page
    setIsSkeletonVisible(false);
  }, [setIsSkeletonVisible]);

  const {
    data: requests,
    isLoading: isLoadingRequest,
    error: docAccessError,
  } = useDocAccessRequests({
    docId: id,
    page: 1,
  });

  const { mutate: createRequest } = useCreateDocAccessRequest();

  const hasRequested = !!requests?.results.find(
    (request) => request.document === id,
  );

  if (isLoadingRequest) {
    return <Loading />;
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>
          {t('Access denied')} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${t('Access denied')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $justify="center"
        $flex="1"
        $gap="var(--xxxs, 4px)"
        $padding={{ bottom: '2rem' }}
      >
        <ErrorAccessDeniedSvg width={102} height={72} aria-hidden="true" />

        <Box $align="center" $gap="0">
          <Text as="p" $weight="bold" $textAlign="center" $margin="0">
            {t('Access denied')}
          </Text>

          <Text
            as="p"
            $textAlign="center"
            $maxWidth="350px"
            $margin="0"
            $css={errorDescriptionStyles}
          >
            {hasRequested
              ? t('Your access request for this document is pending.')
              : t('Insufficient access rights to view the document.')}
          </Text>

          {docAccessError?.status === 404 && (
            <Text
              as="p"
              $textAlign="center"
              $maxWidth="320px"
              $margin="0"
              $css={errorDescriptionStyles}
            >
              {t(
                "You're currently viewing a sub-document. To gain access, please request permission from the main document.",
              )}
            </Text>
          )}
        </Box>

        <Box
          $direction="row"
          $align="flex-start"
          $gap="0.5rem"
          $css="margin-top: var(--base, 16px);"
        >
          <ErrorActionLinkStyled href="/">
            <HomeSvg width={16} height={16} aria-hidden="true" />
            <span className="--docs--error-action-label">{t('Home')}</span>
          </ErrorActionLinkStyled>
          {docAccessError?.status !== 404 && (
            <RequestAccessButton
              onClick={() => createRequest({ docId: id, role: Role.EDITOR })}
              disabled={hasRequested}
            >
              <BubbleTextSvg width={16} height={16} aria-hidden="true" />
              <span className="--docs--error-action-label">
                {t('Request access')}
              </span>
            </RequestAccessButton>
          )}
        </Box>
      </Box>
    </>
  );
};
