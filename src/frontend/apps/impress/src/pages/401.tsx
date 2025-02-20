import { Button } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import img401 from '@/assets/icons/icon-401.png';
import { Box, Text } from '@/components';
import { gotoLogin, useAuth } from '@/features/auth';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { replace } = useRouter();

  useEffect(() => {
    if (authenticated) {
      void replace(`/`);
    }
  }, [authenticated, replace]);

  return (
    <Box
      $align="center"
      $margin="auto"
      $gap="1rem"
      $padding={{ bottom: '2rem' }}
    >
      <Image
        src={img401}
        alt={t('Image 401')}
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
      />

      <Box $align="center" $gap="0.8rem">
        <Text as="p" $textAlign="center" $maxWidth="350px" $theme="primary">
          {t('Log in to access the document.')}
        </Text>

        <Button onClick={() => gotoLogin(false)} aria-label={t('Login')}>
          {t('Login')}
        </Button>
      </Box>
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
