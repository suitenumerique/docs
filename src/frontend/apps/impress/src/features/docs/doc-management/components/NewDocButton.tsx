import { Button, Loader } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useConfig } from '@/core/config/api/useConfig';
import ArrowDownIcon from '@/icons/arrow-drop-down.svg';
import PlusIcon from '@/icons/doc-plus.svg';
import UploadIcon from '@/icons/upload-arrow.svg';

import { useImport } from '../hooks/useImport';

interface NewDocButtonProps {
  onClose?: () => void;
}

export const NewDocButton = ({ onClose }: NewDocButtonProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const { data: config } = useConfig();
  const isDropdownEnabled = config?.CONVERSION_UPLOAD_ENABLED || currentDoc;

  return (
    <>
      <Button
        href="/docs/new"
        data-testid="new-doc-button"
        color="brand"
        onClick={(e) => {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            void router.push('/docs/new');
          }
          onClose?.();
        }}
        icon={<PlusIcon aria-hidden="true" width={24} height={24} />}
        style={{
          borderRadius: isDropdownEnabled ? '4px 0 0 4px' : '4px',
          borderRight:
            '1px solid var(--c--contextuals--background--palette--brand--primary)',
        }}
      >
        <Text $withThemeInherited $size="md" $weight="500">
          {t('New')}
        </Text>
      </Button>
      {isDropdownEnabled && <DropdownArrow />}
    </>
  );
};

export function DropdownArrow() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const {
    getInputProps,
    open: openImport,
    isPending: isImportPending,
    isEnabled: isImportEnabled,
  } = useImport({
    onImportSuccess: (doc) => {
      void router.push(`/docs/${doc.id}/`);
    },
  });

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        label: t('Import a document'),
        icon: <UploadIcon aria-hidden="true" width="24" height="24" />,
        callback: openImport,
        isHidden: !isImportEnabled,
      },
    ],
    [t, openImport, isImportEnabled],
  );

  return (
    <>
      <DropdownMenu
        options={options}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      >
        <Button
          aria-label={t('Open new document options')}
          color="brand"
          variant="primary"
          iconPosition="left"
          icon={
            isImportPending ? (
              <Loader size="small" />
            ) : (
              <ArrowDownIcon aria-hidden="true" width="24" height="24" />
            )
          }
          onClick={!isImportPending ? toggleMenu : undefined}
          aria-disabled={isImportPending}
          style={{ borderRadius: '0 4px 4px 0', width: '30px' }}
        />
      </DropdownMenu>
      <input {...getInputProps()} />
    </>
  );
}
