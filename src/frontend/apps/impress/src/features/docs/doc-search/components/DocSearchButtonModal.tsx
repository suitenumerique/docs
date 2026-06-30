import { Button, ButtonProps } from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import SearchSVG from '@/assets/icons/ui-kit/zoom-rounded.svg';
import { useDocStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useCmdK } from '@/hooks/useCmdK';

const DocSearchModal = dynamic(
  () =>
    import('./DocSearchModal').then((mod) => ({
      default: mod.DocSearchModal,
    })),
  { ssr: false },
);

export const DocSearchButtonModal = ({ ...props }: ButtonProps) => {
  const { currentDoc } = useDocStore();
  const { authenticated } = useAuth();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const canSearch = authenticated || currentDoc?.abilities.search;

  const openSearchModal = useCallback(() => {
    const isEditorToolbarOpen =
      document.getElementsByClassName('bn-formatting-toolbar').length > 0;
    if (isEditorToolbarOpen) {
      return;
    }

    setIsSearchModalOpen(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalOpen(false);
  }, []);

  useCmdK(openSearchModal);

  if (!canSearch) {
    return null;
  }

  return (
    <>
      <Button
        data-testid="search-docs-button"
        onClick={openSearchModal}
        size="medium"
        color="brand"
        variant="tertiary"
        aria-label={t('Search docs')}
        icon={<SearchSVG aria-hidden="true" width={24} height={24} />}
        {...props}
      />
      {isSearchModalOpen && (
        <DocSearchModal
          onClose={closeSearchModal}
          isOpen={isSearchModalOpen}
          doc={currentDoc}
          defaultFilters="all"
        />
      )}
    </>
  );
};
