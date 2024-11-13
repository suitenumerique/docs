import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, SeparatedSection } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useCreateDoc } from '@/features/docs';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { useResponsiveStore } from '@/stores';

export const LeftPanel = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveStore();
  const theme = useCunninghamTheme();
  const colors = theme.colorsTokens();

  const { mutate: createDoc } = useCreateDoc({
    onSuccess: (doc) => {
      router.push(`/docs/${doc.id}`);
    },
  });

  const goToHome = () => {
    router.push('/');
  };

  const createNewDoc = () => {
    createDoc({ title: t('Untitled document') });
  };

  return (
    <>
      {isDesktop && (
        <Box
          data-testid="left-panel-desktop"
          $css={`
            height: calc(100vh - ${HEADER_HEIGHT}px);
            width: 300px;
            min-width: 300px;
            border-right: 1px solid ${colors['greyscale-200']};
        `}
        >
          <div>
            <SeparatedSection>
              <Box
                $padding={{ horizontal: 'sm' }}
                $direction="row"
                $justify="space-between"
                $align="center"
              >
                <Box $direction="row" $gap="2px">
                  <Button
                    onClick={goToHome}
                    size="medium"
                    color="primary-text"
                    icon={<Icon iconName="house" />}
                  />
                </Box>
                <Button onClick={createNewDoc}>{t('New doc')}</Button>
              </Box>
            </SeparatedSection>
            {children}
          </div>
        </Box>
      )}
    </>
  );
};
