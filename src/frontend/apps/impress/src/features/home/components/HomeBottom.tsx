import { Button } from '@openfun/cunningham-react';
import Image from 'next/image';
import { Trans, useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import DocLogo from '@/assets/icons/icon-docs.svg?url';
import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { ProConnectButton } from '@/features/auth';
import { Title } from '@/features/header';
import { useResponsiveStore } from '@/stores';

import SC5 from '../assets/SC5.png';
import GithubIcon from '../assets/github.svg';

import { HomeSection } from './HomeSection';

export function HomeBottom() {
  const { componentTokens } = useCunninghamTheme();
  const withProConnect = componentTokens()['home-proconnect'].activated;

  if (withProConnect) {
    return <HomeProConnect />;
  } else {
    return <HomeOpenSource />;
  }
}

function HomeOpenSource() {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { isTablet } = useResponsiveStore();

  return (
    <HomeSection
      isColumn={false}
      isSmallDevice={isTablet}
      illustration={SC5}
      title={t('Govs ❤️ Open Source.')}
      tag={t('Open Source')}
      textWidth="60%"
      description={
        <Box
          $css={css`
            & a {
              color: ${colorsTokens()['primary-600']};
            }
          `}
        >
          <Text as="p" $display="inline">
            <Trans t={t} i18nKey="home-content-open-source-part1">
              Docs is built on top of{' '}
              <a href="https://www.django-rest-framework.org/" target="_blank">
                Django Rest Framework
              </a>
              ,{' '}
              <a href="https://nextjs.org/" target="_blank">
                Next.js
              </a>
              , and{' '}
              <a href="https://min.io/" target="_blank">
                MinIO
              </a>
              . We also use{' '}
              <a href="https://github.com/yjs" target="_blank">
                Yjs
              </a>{' '}
              and{' '}
              <a href="https://www.blocknotejs.org/" target="_blank">
                BlockNote.js
              </a>{' '}
              of which we are proud sponsors.
            </Trans>
          </Text>
          <Text as="p" $display="inline">
            <Trans t={t} i18nKey="home-content-open-source-part2">
              You can easily self-hosted Docs (check our installation{' '}
              <a
                href="https://github.com/suitenumerique/docs/tree/main/docs"
                target="_blank"
              >
                documentation
              </a>{' '}
              with production-ready examples).
              <br />
              Docs uses an innovation and business friendly{' '}
              <a
                href="https://github.com/suitenumerique/docs/blob/main/LICENSE"
                target="_blank"
              >
                licence
              </a>
              .<br />
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
              Docs is the result of a joint effort lead by the French 🇫🇷🥖
              <a href="https://www.numerique.gouv.fr/dinum/" target="_blank">
                (DINUM)
              </a>{' '}
              and German 🇩🇪🥨 governments{' '}
              <a href="https://zendis.de/" target="_blank">
                (ZenDiS)
              </a>
              . We are always looking for new public partners (we are currently
              onboarding the Netherlands 🇳🇱🧀). Feel free to reach out if you
              are interested in using or contributing to docs.
            </Trans>
          </Text>
          <Box $direction="row" $gap="1rem" $margin={{ top: 'small' }}>
            <Button
              icon={
                <Text $isMaterialIcon $color="white">
                  chat
                </Text>
              }
              href="https://matrix.to/#/#docs-official:matrix.org"
              target="_blank"
            >
              <Text $color="white">Matrix</Text>
            </Button>
            <Button
              color="secondary"
              icon={<GithubIcon />}
              href="https://github.com/suitenumerique/docs"
              target="_blank"
            >
              Github
            </Button>
          </Box>
        </Box>
      }
    />
  );
}

function HomeProConnect() {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const { isMobile } = useResponsiveStore();
  const parentGap = '230px';

  return (
    <Box
      $justify="center"
      $height={!isMobile ? `calc(100vh - ${parentGap})` : 'auto'}
    >
      <Box
        $gap={spacings['md']}
        $direction="column"
        $align="center"
        $margin={{ top: isMobile ? 'none' : `-${parentGap}` }}
      >
        <Box
          $align="center"
          $gap={spacings['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
          $css="zoom: 1.9;"
        >
          <Image src={DocLogo} alt="DocLogo" />
          <Title />
        </Box>
        <Text $size="md" $variation="1000" $textAlign="center">
          {t('Docs is already available, log in to use it now.')}
        </Text>
        <ProConnectButton />
      </Box>
    </Box>
  );
}
