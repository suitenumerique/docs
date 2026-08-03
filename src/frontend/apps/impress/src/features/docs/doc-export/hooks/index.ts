/**
 * To import export modules you must import from the index file.
 * This is to ensure that the export modules are only loaded when
 * the application is not published as MIT.
 */

import * as useExportAGPL from './useExportAGPL';

let modulesExport = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesExport = {
    ...useExportAGPL,
  };
}

type ModulesExport = typeof useExportAGPL;

export default modulesExport as ModulesExport;
