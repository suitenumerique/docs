import { Button } from '@gouvfr-lasuite/cunningham-react';
import Head from 'next/head';
import Image from 'next/image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import img403 from '@/assets/icons/icon-403.png';
import { Box, Icon, StyledLink, Text } from '@/components';
import { useSkeletonStore } from '@/features/skeletons';

const StyledButton = styled(Button)`
  width: fit-content;
`;

interface DocProps {
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DocPage403 = ({ id }: DocProps) => {
  const { t } = useTranslation();
  const { setIsSkeletonVisible } = useSkeletonStore();

  useEffect(() => {
    // Ensure the skeleton overlay is hidden on 403 page
    setIsSkeletonVisible(false);
  }, [setIsSkeletonVisible]);

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
          <Text as="p" $textAlign="center" $maxWidth="350px" $theme="brand">
            {t('Insufficient access rights to view the document.')}
          </Text>

          {/* Sharing is managed in Drive: ask for access from the Drive app. */}
          <Text
            as="p"
            $maxWidth="320px"
            $textAlign="center"
            $size="sm"
            $margin={{ top: '0' }}
          >
            {t('Ask the document owner to share it with you from Drive.')}
          </Text>

          <Box $direction="row" $gap="0.7rem">
            <StyledLink href="/">
              <StyledButton
                icon={<Icon iconName="house" $withThemeInherited />}
                color="brand"
                variant="secondary"
              >
                {t('Home')}
              </StyledButton>
            </StyledLink>
          </Box>
        </Box>
      </Box>
    </>
  );
};
