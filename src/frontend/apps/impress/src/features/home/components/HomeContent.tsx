import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import IconDocs from '@/assets/common/logo-docs.svg';
import { Box, Text } from '@/components';
import { ProConnectButton } from '@/components/ProConnectButton';
import { useCunninghamTheme } from '@/cunningham';
import { Footer } from '@/features/footer';
import Title from '@/features/header/components/Title/Title';
import { useLanguage } from '@/i18n/hooks/useLanguage';
import { useResponsiveStore } from '@/stores';

import SC1Responsive from '../assets/SC1-responsive.png';
import SC2 from '../assets/SC2.png';
import SC3 from '../assets/SC3.png';
import SC4Responsive from '../assets/SC4-responsive.png';
import SC4 from '../assets/SC4.png';

import HomeBanner from './HomeBanner';
import { HomeHeader } from './HomeHeader';
import { HomeSection } from './HomeSection';

const GlobalHomePageStyle = createGlobalStyle`
  html {
    scroll-behavior: smooth;
  }
`;

export default function HomeContent() {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const lang = useLanguage();

  return (
    <>
      <GlobalHomePageStyle />
      <Box $background="white">
        <HomeHeader />
        <Box $align="center" $justify="center">
          <Box
            $maxWidth="78rem"
            $width="100%"
            $justify="center"
            $align="center"
          >
            <HomeBanner />
            <Box
              id="docs-app-info"
              $gap={isDesktop ? '230px' : '115px'}
              $padding={{
                vertical: spacings['6xl'],
              }}
            >
              <HomeSection
                isColumn={true}
                illustration={isDesktop ? undefined : SC1Responsive}
                video={
                  isDesktop ? `assets/SC1-${lang.language}.webm` : undefined
                }
                title={t('An uncompromising writing experience.')}
                tag={t('Write')}
                description={t(
                  'Docs offers an intuitive writing experience. Its minimalist interface favors content over layout, while offering the essentials: media import, offline mode and keyboard shortcuts for greater efficiency.',
                )}
              />
              <HomeSection
                isColumn={false}
                illustration={SC2}
                title={t('Simple and secure collaboration.')}
                tag={t('Collaborate')}
                description={t(
                  'Docs makes real-time collaboration simple. Invite collaborators - public officials or external partners - with one click to see their changes live, while maintaining precise access control for data security.',
                )}
              />
              <HomeSection
                isColumn={false}
                reverse={true}
                illustration={SC3}
                title={t('Flexible export.')}
                tag={t('Export')}
                description={t(
                  'To facilitate the circulation of documents, Docs allows you to export your content to the most common formats: PDF, Word or OpenDocument.',
                )}
              />

              <HomeSection
                illustration={isDesktop ? SC4 : SC4Responsive}
                title={t('A new way to organize knowledge.')}
                tag={t('Organize')}
                availableSoon={true}
                description={t(
                  'Docs transforms your documents into knowledge bases thanks to subpages, powerful search and the ability to pin your important documents.',
                )}
              />
              <Box
                $gap={spacings['md']}
                $justify="center"
                $align="center"
                $padding={{ vertical: '140px' }}
              >
                <Box
                  $align="center"
                  $gap={spacings['3xs']}
                  $direction="row"
                  $position="relative"
                  $height="fit-content"
                >
                  <IconDocs />
                  <Title size="md" />
                </Box>
                <Text $size="md" $variation="1000" $textAlign="center">
                  {t('Docs is already available, log in to use it now.')}
                </Text>
                <ProConnectButton />
              </Box>
            </Box>
          </Box>
        </Box>
        <Footer />
      </Box>
    </>
  );
}
