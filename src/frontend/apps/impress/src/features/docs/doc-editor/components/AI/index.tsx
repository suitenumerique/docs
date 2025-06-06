import dynamic from 'next/dynamic';
import { FC } from 'react';

export { useAI } from './useAI';
export * from './useModuleAI';

const AIMenuController = dynamic(() =>
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./libAGPL').then((mod) => mod.AIMenuController)
    : Promise.resolve(() => <></>),
);

const AIToolbarButton = dynamic(() =>
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./AIUI').then((mod) => mod.AIToolbarButton)
    : Promise.resolve(() => <></>),
);

const AIMenu = dynamic(() =>
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./AIUI').then((mod) => mod.AIMenu)
    : Promise.resolve(() => <></>),
) as FC<unknown>;

const modGetAISlashMenuItems =
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./libAGPL').then((mod) => mod.getAISlashMenuItems)
    : Promise.resolve(null);

export { AIMenu, AIMenuController, AIToolbarButton, modGetAISlashMenuItems };
