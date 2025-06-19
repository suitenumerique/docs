import {
  Button,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import img403 from '@/assets/icons/icon-403.png';
import { Box, Icon, StyledLink, Text } from '@/components';
import {
  useCreateDocAccessRequest,
  useDocAccessRequests,
} from '@/features/docs/doc-share/api/useDocAccessRequest';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const StyledButton = styled(Button)`
  width: fit-content;
`;

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

      <MainLayout>
        <DocPage403 id={id} />
      </MainLayout>
    </>
  );
}

interface DocProps {
  id: string;
}

const DocPage403 = ({ id }: DocProps) => {
  const { t } = useTranslation();
  const { data: requests } = useDocAccessRequests({ docId: id });
  const { toast } = useToastProvider();
  const { mutate: createRequest } = useCreateDocAccessRequest({
    onSuccess: () => {
      toast(t('Access request sent successfully.'), VariantType.SUCCESS, {
        duration: 3000,
      });
    },
  });

  const hasRequested = !!requests?.results.find(
    (request) => request.document === id,
  );

  return (
    <>
      <Head>
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

          <Box $direction="row" $gap="0.7rem">
            <StyledLink href="/">
              <StyledButton
                icon={<Icon iconName="house" $theme="primary" />}
                color="tertiary"
              >
                {t('Home')}
              </StyledButton>
            </StyledLink>
            <Button
              onClick={() => createRequest({ docId: id })}
              disabled={hasRequested}
            >
              {t('Request access')}
            </Button>
          </Box>
        </Box>
      </Box>
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
