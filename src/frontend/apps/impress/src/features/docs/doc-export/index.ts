/**
 * To import Export modules you must import from the index file.
 * This is to ensure that the Export modules are only loaded when
 * the application is not published as MIT.
 */
export * from './api';
export * from './utils';

import * as ModalExport from './components/ModalExport';

let modulesExport = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesExport = {
    ...ModalExport,
  };
}

type ModulesExport = typeof modulesExport;

export default modulesExport as ModulesExport;
