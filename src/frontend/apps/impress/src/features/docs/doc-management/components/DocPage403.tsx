import { Button } from '@openfun/cunningham-react';
import Head from 'next/head';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import img403 from '@/assets/icons/icon-403.png';
import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { ButtonAccessRequest } from '@/docs/doc-share';
import { useDocAccessRequests } from '@/docs/doc-share/api/useDocAccessRequest';

const StyledButton = styled(Button)`
  width: fit-content;
`;

interface DocProps {
  id: string;
}

export const DocPage403 = ({ id }: DocProps) => {
  const { t } = useTranslation();
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
        $gap="1rem"
        $padding={{ bottom: '2rem' }}
      >
        <Image
          className="c__image-system-filter"
          src={img403}
          alt={t('Image 403')}
          width={300}
          height={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />

        <Box $align="center" $gap="0.8rem">
          <Text as="p" $textAlign="center" $maxWidth="350px" $theme="primary">
            {hasRequested
              ? t('Your access request for this document is pending.')
              : t('Insufficient access rights to view the document.')}
          </Text>

          {docAccessError?.status === 404 && (
            <Text
              as="p"
              $maxWidth="320px"
              $textAlign="center"
              $variation="600"
              $size="sm"
              $margin={{ top: '0' }}
            >
              {t(
                "You're currently viewing a sub-document. To gain access, please request permission from the main document.",
              )}
            </Text>
          )}

          <Box $direction="row" $gap="0.7rem">
            <StyledLink href="/">
              <StyledButton
                icon={<Icon iconName="house" $theme="primary" />}
                color="tertiary"
              >
                {t('Home')}
              </StyledButton>
            </StyledLink>
            {docAccessError?.status !== 404 && (
              <ButtonAccessRequest docId={id} />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};
