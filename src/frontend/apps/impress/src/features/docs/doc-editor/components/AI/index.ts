/**
 * To import AI modules you must import from the index file.
 * This is to ensure that the AI modules are only loaded when
 * the application is not published as MIT.
 */
import * as XLAI from '@blocknote/xl-ai';
import * as localesAI from '@blocknote/xl-ai/locales';

import * as AIUI from './AIUI';
import * as useAI from './useAI';

let modulesAI = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesAI = {
    ...XLAI,
    ...AIUI,
    localesAI: localesAI,
    ...useAI,
  };
}

type ModulesAI = typeof XLAI &
  typeof AIUI & { localesAI: typeof localesAI } & typeof useAI;

export default modulesAI as ModulesAI;
