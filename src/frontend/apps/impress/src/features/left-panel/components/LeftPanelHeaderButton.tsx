import { Button } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import { Box, DropdownMenu, Icon } from '@/components';
import { useCreateDoc } from '@/features/docs/doc-management';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeaderButton = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { togglePanel } = useLeftPanelStore();
  const { mutate: createDoc, isPending: isDocCreating } = useCreateDoc({
    onSuccess: (doc) => {
      void router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const handleImportNotion = () => {
    const baseApiUrl = process.env.NEXT_PUBLIC_API_ORIGIN;
    const notionAuthUrl = `${baseApiUrl}/api/v1.0/notion_import/redirect`;
    window.location.href = notionAuthUrl;
  };

  return (<Box $direction="row" $align="center">
    <Button
      data-testid="new-doc-button"
      color="primary"
      onClick={() => createDoc()}
      icon={<Icon $variation="000" iconName="add" aria-hidden="true" />}
      disabled={isDocCreating}
    >
      {t('New doc')}
    </Button>
    <DropdownMenu
      showArrow
      disabled={isDocCreating}
      options={[
        {
          label: t('Import from Notion'),
          callback: handleImportNotion,
          padding: { vertical: 'xs', horizontal: 'md' },
        },
      ]}
    >
    </DropdownMenu>
  </Box>);
};
