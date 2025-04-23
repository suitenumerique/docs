import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import {
  Doc,
  isOwnerOrAdmin,
  useCreateChildDoc,
  useCreateDoc,
  useDocStore,
} from '@/docs/doc-management';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeaderButton = () => {
  const router = useRouter();
  const isDoc = router.pathname === '/docs/[id]';

  if (isDoc) {
    return <LeftPanelHeaderDocButton />;
  }

  return <LeftPanelHeaderHomeButton />;
};

export const LeftPanelHeaderHomeButton = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { togglePanel } = useLeftPanelStore();
  const { mutate: createDoc } = useCreateDoc({
    onSuccess: (doc) => {
      void router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });
  return (
    <Button color="primary" onClick={() => createDoc()}>
      {t('New doc')}
    </Button>
  );
};

export const LeftPanelHeaderDocButton = () => {
  const router = useRouter();
  const { currentDoc } = useDocStore();
  const { t } = useTranslation();
  const { togglePanel } = useLeftPanelStore();
  const treeContext = useTreeContext<Doc>();
  const tree = treeContext?.treeData;
  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (doc) => {
      tree?.addRootNode(doc);
      tree?.selectNodeById(doc.id);
      void router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const onCreateDoc = () => {
    if (!treeContext?.root) {
      return;
    }

    createChildDoc({
      parentId: treeContext.root.id,
    });
  };

  const disabled =
    (currentDoc && !isOwnerOrAdmin(currentDoc)) || !treeContext?.root;

  return (
    <Button color="tertiary" onClick={onCreateDoc} disabled={disabled}>
      {t('New page')}
    </Button>
  );
};
