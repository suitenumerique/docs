import { components as mantineComponents } from '@blocknote/mantine';
import { ComponentsContext, useComponentsContext } from '@blocknote/react';
import {
  useDeleteVersionAction,
  useNameVersionAction,
  useRestoreVersionAction,
} from '@blocknote/react/versioning';
import { type ComponentProps, type ReactNode, useMemo } from 'react';

const SkinSnapshot = mantineComponents.Versioning.Snapshot;

const SnapshotWithAvailableActions = (
  props: ComponentProps<typeof SkinSnapshot>,
) => {
  const name = useNameVersionAction();
  const restore = useRestoreVersionAction();
  const deleteVersion = useDeleteVersionAction();
  // Keep this aligned with the three items in our snapshotMenu. The restore
  // confirmation item has no eligibility conditions beyond this action hook.
  const hasActions =
    name.available || restore.available || deleteVersion.available;

  return (
    <SkinSnapshot {...props} actions={hasActions ? props.actions : null} />
  );
};

export const VersioningComponentsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const components = useComponentsContext() ?? mantineComponents;
  const value = useMemo(
    () => ({
      ...components,
      Versioning: {
        ...components.Versioning,
        Snapshot: SnapshotWithAvailableActions,
      },
    }),
    [components],
  );

  return (
    <ComponentsContext.Provider value={value}>
      {children}
    </ComponentsContext.Provider>
  );
};
