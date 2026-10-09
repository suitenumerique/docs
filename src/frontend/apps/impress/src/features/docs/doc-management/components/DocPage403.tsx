import Head from 'next/head';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import Error403Svg from '@/assets/icons/error-403.svg';
import BubbleTextSvg from '@/assets/icons/ui-kit/bubble-text.svg';
import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { ButtonAccessRequest } from '@/docs/doc-share';
import { useDocAccessRequests } from '@/docs/doc-share/api/useDocAccessRequest';
import { useSkeletonStore } from '@/features/skeletons';
import HomeSvg from '@/icons/house-rounded.svg';

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

  const hasRequested = !!requests?.results.find(
    (request) => request.document === id,
  );
  const isSubDocument = docAccessError?.status === 404;

  if (isLoadingRequest) {
    return <Loading />;
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>
          {t('Access Denied - Error 403')} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${t('Access Denied - Error 403')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="base"
        $padding={{ horizontal: 'base', bottom: 'lg' }}
        className="--docs--error-403"
      >
        <Box $align="center" $gap="xxxs">
          <Error403Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Access denied')}
          </Text>
          <Text
            as="p"
            $textAlign="center"
            $maxWidth="228px"
            $theme="neutral"
            $variation="secondary"
            $margin="0"
            $size="xs"
          >
            {hasRequested
              ? t('Your access request for this document is pending.')
              : t('Insufficient access rights to view the document.')}
          </Text>
          {isSubDocument && (
            <Text
              as="p"
              $textAlign="center"
              $maxWidth="228px"
              $theme="neutral"
              $variation="secondary"
              $margin="0"
              $size="xs"
            >
              {t(
                "You're currently viewing a sub-document. To gain access, please request permission from the main document.",
              )}
            </Text>
          )}
        </Box>
        <Box $direction="row" $align="center" $gap="base">
          <StyledLink
            href="/"
            $css={css`
              display: flex;
              align-items: center;
              flex-direction: row;
              gap: var(--c--globals--spacings--3xs);
              outline: none;
              &:focus-visible {
                outline: 2px solid
                  var(--c--contextuals--content--semantic--neutral--tertiary);
                border-radius: 1px;
                outline-offset: var(--c--globals--spacings--st);
              }
            `}
          >
            <Icon
              icon={<HomeSvg width={16} height={16} />}
              $theme="neutral"
              $variation="tertiary"
            />
            <Text
              $size="sm"
              $weight={500}
              $theme="neutral"
              $variation="tertiary"
              $margin="0"
            >
              {t('Home')}
            </Text>
          </StyledLink>
          {!isSubDocument && (
            <ButtonAccessRequest
              docId={id}
              color="brand"
              variant="tertiary"
              size="small"
              icon={<BubbleTextSvg width={16} height={16} aria-hidden="true" />}
            />
          )}
        </Box>
      </Box>
    </>
  );
};
