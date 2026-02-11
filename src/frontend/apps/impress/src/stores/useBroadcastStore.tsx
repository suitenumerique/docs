import * as Y from 'yjs';
import { create } from 'zustand';

import { SwitchableProvider } from '@/features/docs/doc-management/stores/useProviderStore';

interface BroadcastState {
  addTask: (taskLabel: string, action: () => void) => void;
  broadcast: (taskLabel: string) => void;
  cleanupBroadcast: () => void;
  getBroadcastProvider: () => SwitchableProvider | undefined;
  handleProviderSync: () => void;
  provider?: SwitchableProvider;
  setBroadcastProvider: (provider: SwitchableProvider) => void;
  setTask: (
    taskLabel: string,
    task: Y.Array<string>,
    action: () => void,
  ) => void;
  tasks: {
    [taskLabel: string]: {
      action: () => void;
      observer: (
        event: Y.YArrayEvent<string>,
        transaction: Y.Transaction,
      ) => void;
      task: Y.Array<string>;
    };
  };
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  provider: undefined,
  tasks: {},
  setBroadcastProvider: (provider) => {
    // Clean up old provider listeners
    const oldProvider = get().provider;
    if (oldProvider) {
      // oldProvider.off('synced', get().handleProviderSync);
      oldProvider.off('sync', get().handleProviderSync);
    }

    // provider.on('synced', get().handleProviderSync);
    provider.on('sync', get().handleProviderSync);
    set({ provider });
  },
  handleProviderSync: () => {
    const tasks = get().tasks;
    Object.entries(tasks).forEach(([taskLabel, { action }]) => {
      get().addTask(taskLabel, action);
    });
  },
  getBroadcastProvider: () => {
    const provider = get().provider;
    if (!provider) {
      console.warn('Provider is not defined');
      return;
    }

    return provider;
  },
  addTask: (taskLabel, action) => {
    const provider = get().getBroadcastProvider();
    if (!provider) {
      return;
    }

    const task = provider.document.getArray<string>(taskLabel);
    get().setTask(taskLabel, task, action);
  },
  setTask: (taskLabel: string, task: Y.Array<string>, action: () => void) => {
    let isInitializing = true;
    const observer = (
      _event: Y.YArrayEvent<string>,
      transaction: Y.Transaction,
    ) => {
      if (!isInitializing && !transaction.local) {
        action();
      }
    };

    task.observe(observer);

    setTimeout(() => {
      isInitializing = false;
    }, 1000);

    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskLabel]: {
          task,
          observer,
          action,
        },
      },
    }));
  },
  broadcast: (taskLabel) => {
    // Broadcast via Y.js provider (for users on the same document)
    const obTask = get().tasks?.[taskLabel];
    if (obTask?.task) {
      obTask.task.push([`broadcast: ${taskLabel}`]);
    }
  },
  cleanupBroadcast: () => {
    const provider = get().provider;
    if (provider) {
      // provider.off('synced', get().handleProviderSync);
      provider.off('sync', get().handleProviderSync);
    }

    // Unobserve all document-specific tasks
    Object.values(get().tasks).forEach(({ task, observer }) => {
      task.unobserve(observer);
    });
  },
}));
