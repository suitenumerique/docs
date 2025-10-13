import { Button } from '@openfun/cunningham-react';
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
  return (
    <Box $direction="row" $align="center" $gap="0.4rem">
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
        label={t('Open the header menu')}
        options={[
          {
            label: t('Import from Outline'),
            callback: () => void router.push('/import/outline'),
            showSeparator: false,
          },
        ]}
      ></DropdownMenu>
    </Box>
  );
};
