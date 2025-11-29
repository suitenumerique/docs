import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

interface BroadcastState {
  addTask: (taskLabel: string, action: () => void) => void;
  broadcast: (taskLabel: string) => void;
  getBroadcastProvider: () => HocuspocusProvider | undefined;
  provider?: HocuspocusProvider;
  setBroadcastProvider: (provider: HocuspocusProvider) => void;
  setTask: (
    taskLabel: string,
    task: Y.Array<string>,
    action: () => void,
  ) => void;
  tasks: {
    [taskLabel: string]: {
      task: Y.Array<string>;
      observer: (
        event: Y.YArrayEvent<string>,
        transaction: Y.Transaction,
      ) => void;
    };
  };
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  provider: undefined,
  tasks: {},
  setBroadcastProvider: (provider) => set({ provider }),
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

    const existingTask = get().tasks[taskLabel];
    if (existingTask) {
      existingTask.task.unobserve(existingTask.observer);
      get().setTask(taskLabel, existingTask.task, action);
      return;
    }

    const task = provider.document.getArray<string>(taskLabel);
    get().setTask(taskLabel, task, action);
  },
  setTask: (taskLabel: string, task: Y.Array<string>, action: () => void) => {
    let isInitializing = true;
    const observer = () => {
      if (!isInitializing) {
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
        },
      },
    }));
  },
  broadcast: (taskLabel) => {
    const obTask = get().tasks?.[taskLabel];
    if (!obTask || !obTask.task) {
      console.warn(`Task ${taskLabel} is not defined`);
      return;
    }
    obTask.task.push([`broadcast: ${taskLabel}`]);
  },
}));
