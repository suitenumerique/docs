import { Button } from '@gouvfr-lasuite/cunningham-react';
import { Trans, useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { Footer } from '@/features/footer';
import { LeftPanel } from '@/features/left-panel';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
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
import SC5 from '../assets/SC5.png';
import GithubIcon from '../assets/github.svg';

import HomeBanner from './HomeBanner';
import { HomeBottom } from './HomeBottom';
import { HomeHeader, getHeaderHeight } from './HomeHeader';
import { HomeSection } from './HomeSection';

export function HomeContent() {
  const { i18n, t } = useTranslation();
  const { isMobile, isSmallMobile, isTablet } = useResponsiveStore();
  const isFrLanguage = i18n.resolvedLanguage === 'fr';

  return (
    <Box
      as="main"
      role="main"
      id={MAIN_LAYOUT_ID}
      tabIndex={-1}
      className="--docs--home-content"
      aria-label={t('Main content')}
      $css={css`
        &:focus {
          outline: 3px solid var(--c--globals--colors--primary-600);
          outline-offset: -3px;
        }
        &:focus:not(:focus-visible) {
          outline: none;
        }
      `}
    >
      <HomeHeader />
      {isSmallMobile && (
        <Box $css="& .--docs--left-panel-header{display: none;}">
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
            <Box $gap={isMobile ? '115px' : '30px'}>
              <HomeSection
                isColumn={false}
                isSmallDevice={isTablet}
                illustration={SC5}
                title={t('Govs ❤️ Open Source.')}
                tag={t('Open Source')}
                textWidth="60%"
                $css={`min-height: calc(100vh - ${getHeaderHeight(isSmallMobile)}px);`}
                description={
                  <Box>
                    <Box
                      $css={css`
                        & a {
                          color: inherit;
                        }
                      `}
                    >
                      <Text as="p" $display="inline" $variation="secondary">
                        <Trans t={t} i18nKey="home-content-open-source-part1">
                          Docs is built on top of{' '}
                          <a
                            href="https://www.django-rest-framework.org/"
                            target="_blank"
                          >
                            Django Rest Framework
                          </a>{' '}
                          and{' '}
                          <a href="https://nextjs.org/" target="_blank">
                            Next.js
                          </a>
                          . We also use{' '}
                          <a href="https://github.com/yjs" target="_blank">
                            Yjs
                          </a>{' '}
                          and{' '}
                          <a
                            href="https://www.blocknotejs.org/"
                            target="_blank"
                          >
                            BlockNote.js
                          </a>
                          , both of which we are proud to sponsor.
                        </Trans>
                      </Text>
                      <Text as="p" $display="inline">
                        <Trans t={t} i18nKey="home-content-open-source-part2">
                          You can easily self-host Docs (check our installation{' '}
                          <a
                            href="https://github.com/suitenumerique/docs/tree/main/docs"
                            target="_blank"
                          >
                            documentation
                          </a>
                          ).
                          <br />
                          Docs uses an innovation and business friendly{' '}
                          <a
                            href="https://github.com/suitenumerique/docs/blob/main/LICENSE"
                            target="_blank"
                          >
                            licence
                          </a>{' '}
                          (MIT).
                          <br />
                          Contributions are welcome (see our roadmap{' '}
                          <a
                            href="https://github.com/orgs/numerique-gouv/projects/13/views/11"
                            target="_blank"
                          >
                            here
                          </a>
                          ).
                        </Trans>
                      </Text>
                      <Text as="p" $display="inline">
                        <Trans t={t} i18nKey="home-content-open-source-part3">
                          Docs is the result of a joint effort lead by the
                          French 🇫🇷🥖
                          <a
                            href="https://www.numerique.gouv.fr/dinum/"
                            target="_blank"
                          >
                            (DINUM)
                          </a>{' '}
                          and German 🇩🇪🥨 governments{' '}
                          <a href="https://zendis.de/" target="_blank">
                            (ZenDiS)
                          </a>
                          .
                        </Trans>
                      </Text>
                    </Box>
                    <Box
                      $direction="row"
                      $gap="1rem"
                      $margin={{ top: 'small' }}
                    >
                      <Button
                        icon={<Icon iconName="chat" $color="white" />}
                        href="https://matrix.to/#/#docs-official:matrix.org"
                        target="_blank"
                      >
                        Matrix
                      </Button>
                      <Button
                        color="neutral"
                        variant="secondary"
                        icon={<GithubIcon />}
                        href="https://github.com/suitenumerique/docs"
                        target="_blank"
                      >
                        GitHub
                      </Button>
                    </Box>
                  </Box>
                }
              />
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
            </Box>
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
              availableSoon={false}
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
