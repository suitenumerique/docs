import { Button } from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Doc, ModalRemoveDoc } from '@/features/docs/doc-management';

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);

  if (!doc.abilities.destroy) {
    return null;
  }

  return (
    <>
      <Button
        data-testid={`docs-grid-delete-button-${doc.id}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsModalRemoveOpen(true);
        }}
        color="tertiary-text"
        icon={<span className="material-icons">delete</span>}
        size="small"
        style={{ padding: '0rem' }}
        aria-label={t('Delete the document')}
      />
      {isModalRemoveOpen && (
        <ModalRemoveDoc onClose={() => setIsModalRemoveOpen(false)} doc={doc} />
      )}
    </>
  );
};
