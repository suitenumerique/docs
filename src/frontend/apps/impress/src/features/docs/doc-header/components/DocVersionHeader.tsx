import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocTitleText } from './DocTitle';

interface DocVersionHeaderProps {
  title: string;
}

export const DocVersionHeader = ({ title }: DocVersionHeaderProps) => {
  const { spacingsTokens } = useCunninghamTheme();

  const spacings = spacingsTokens();
  const { t } = useTranslation();

  return (
    <>
      <Box
        $width="100%"
        $padding={{ vertical: 'base' }}
        $gap={spacings['base']}
        aria-label={t('It is the document title')}
      >
        <DocTitleText title={title} />
        <HorizontalSeparator />
      </Box>
    </>
  );
};
