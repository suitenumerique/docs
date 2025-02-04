import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { LeftPanel } from '@/features/left-panel';
import { useLanguage } from '@/i18n/hooks/useLanguage';
import { useResponsiveStore } from '@/stores';

import SC1Responsive from '../assets/SC1-responsive.png';
import SC2 from '../assets/SC2.jpg';
import SC3 from '../assets/SC3.jpg';
import SC4Responsive from '../assets/SC4-responsive.png';
import SC4 from '../assets/SC4.png';

import HomeBanner from './HomeBanner';
import { HomeBottom } from './HomeBottom';
import { HEADER_HEIGHT, HomeHeader } from './HomeHeader';
import { HomeSection } from './HomeSection';

export function HomeContent() {
  const { t } = useTranslation();
  const { isMobile, isSmallMobile } = useResponsiveStore();
  const lang = useLanguage();

  return (
    <Box as="main">
      <HomeHeader />
      {isSmallMobile && (
        <Box $css="& .panel-header{display: none;}">
          <LeftPanel />
        </Box>
      )}
      <Box
        $css={css`
          height: calc(100vh - ${HEADER_HEIGHT}px);
          overflow-y: auto;
        `}
      >
        <Box
          $align="center"
          $justify="center"
          $maxWidth="1120px"
          $padding={{ horizontal: isSmallMobile ? '1rem' : '3rem' }}
          $width="100%"
          $margin="auto"
        >
          <HomeBanner />
          <Box
            id="docs-app-info"
            $maxWidth="100%"
            $gap="8rem"
            $padding={{ bottom: '3rem' }}
          >
            <HomeSection
              isColumn={true}
              isSmallDevice={isMobile}
              illustration={SC1Responsive}
              video={`/assets/SC1-${lang.language}.webm`}
              title={t('An uncompromising writing experience.')}
              tag={t('Write')}
              description={t(
                'Docs offers an intuitive writing experience. Its minimalist interface favors content over layout, while offering the essentials: media import, offline mode and keyboard shortcuts for greater efficiency.',
              )}
            />
            <HomeSection
              isColumn={false}
              isSmallDevice={isMobile}
              illustration={SC2}
              title={t('Simple and secure collaboration.')}
              tag={t('Collaborate')}
              description={t(
                'Docs makes real-time collaboration simple. Invite collaborators - public officials or external partners - with one click to see their changes live, while maintaining precise access control for data security.',
              )}
            />
            <HomeSection
              isColumn={false}
              isSmallDevice={isMobile}
              reverse={true}
              illustration={SC3}
              title={t('Flexible export.')}
              tag={t('Export')}
              description={t(
                'To facilitate the circulation of documents, Docs allows you to export your content to the most common formats: PDF, Word or OpenDocument.',
              )}
            />
            <HomeSection
              isSmallDevice={isMobile}
              illustration={!isMobile ? SC4 : SC4Responsive}
              title={t('A new way to organize knowledge.')}
              tag={t('Organize')}
              availableSoon={true}
              description={t(
                'Docs transforms your documents into knowledge bases thanks to subpages, powerful search and the ability to pin your important documents.',
              )}
            />
            <HomeBottom />
          </Box>
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}
