import {
  Button,
  Tooltip as TooltipBase,
} from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Icon, Text } from '@/components';

const Tooltip = styled(TooltipBase)`
  & {
    max-width: 200px;

    .c__tooltip__content {
      max-width: 200px;
      width: max-content;
    }
  }
`;

export const ButtonImport = ({
  onUploadClick,
}: {
  onUploadClick: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      content={
        <Text $textAlign="center" $theme="neutral" $variation="tertiary">
          {t('Import Docx or Markdown files')}
        </Text>
      }
    >
      <Button
        color="brand"
        variant="tertiary"
        onClick={(e) => {
          e.stopPropagation();
          onUploadClick();
        }}
        aria-label={t('Open the upload dialog')}
      >
        <Icon iconName="upload_file" $withThemeInherited />
      </Button>
    </Tooltip>
  );
};
