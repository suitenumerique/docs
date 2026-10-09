/**
 * To import export modules you must import from the index file.
 * This is to ensure that the export modules are only loaded when
 * the application is not published as MIT.
 */

import * as useExportXL from './useExportXL';

let modulesExport = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesExport = {
    ...useExportXL,
  };
}

type ModulesExport = typeof useExportXL;

export default modulesExport as ModulesExport;
