import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocTitleText } from './DocTitle';

export const DocVersionHeader = () => {
  const { spacingsTokens } = useCunninghamTheme();

  const { t } = useTranslation();

  return (
    <>
      <Box
        $width="100%"
        $padding={{ vertical: 'base' }}
        $gap={spacingsTokens['base']}
        aria-label={t('It is the document title')}
        className="--docs--doc-version-header"
      >
        <DocTitleText />
        <HorizontalSeparator />
      </Box>
    </>
  );
};
