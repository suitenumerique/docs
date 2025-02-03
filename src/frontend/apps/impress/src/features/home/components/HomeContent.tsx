import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { LeftPanel } from '@/features/left-panel';
import { useLanguage } from '@/i18n/hooks/useLanguage';
import { useResponsiveStore } from '@/stores';

import SC1ResponsiveEn from '../assets/SC1-responsive-en.png';
import SC1ResponsiveFr from '../assets/SC1-responsive-fr.png';
import SC2En from '../assets/SC2-en.png';
import SC2Fr from '../assets/SC2-fr.png';
import SC3En from '../assets/SC3-en.png';
import SC3Fr from '../assets/SC3-fr.png';
import SC4En from '../assets/SC4-en.png';
import SC4Fr from '../assets/SC4-fr.png';
import SC4ResponsiveEn from '../assets/SC4-responsive-en.png';
import SC4ResponsiveFr from '../assets/SC4-responsive-fr.png';

import HomeBanner from './HomeBanner';
import { HomeBottom } from './HomeBottom';
import { HomeHeader, getHeaderHeight } from './HomeHeader';
import { HomeSection } from './HomeSection';

export function HomeContent() {
  const { t } = useTranslation();
  const { isMobile, isSmallMobile } = useResponsiveStore();
  const lang = useLanguage();
  const isFrLanguage = lang.language === 'fr';

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
          height: calc(100vh - ${getHeaderHeight(isSmallMobile)}px);
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
            $gap={isMobile ? '115px' : '230px'}
            $padding={{ bottom: '3rem' }}
          >
            <HomeSection
              isColumn={true}
              isSmallDevice={isMobile}
              illustration={isFrLanguage ? SC1ResponsiveFr : SC1ResponsiveEn}
              video={
                isFrLanguage ? `/assets/SC1-fr.webm` : `/assets/SC1-en.webm`
              }
              title={t('An uncompromising writing experience.')}
              tag={t('Write')}
              description={t(
                'Docs offers an intuitive writing experience. Its minimalist interface favors content over layout, while offering the essentials: media import, offline mode and keyboard shortcuts for greater efficiency.',
              )}
            />
            <HomeSection
              isColumn={false}
              isSmallDevice={isMobile}
              illustration={isFrLanguage ? SC2Fr : SC2En}
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
              illustration={isFrLanguage ? SC3Fr : SC3En}
              title={t('Flexible export.')}
              tag={t('Export')}
              description={t(
                'To facilitate the circulation of documents, Docs allows you to export your content to the most common formats: PDF, Word or OpenDocument.',
              )}
            />
            <HomeSection
              isSmallDevice={isMobile}
              illustration={
                isMobile
                  ? isFrLanguage
                    ? SC4ResponsiveFr
                    : SC4ResponsiveEn
                  : isFrLanguage
                    ? SC4Fr
                    : SC4En
              }
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
