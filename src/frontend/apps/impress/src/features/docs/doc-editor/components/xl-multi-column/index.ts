/**
 * To import XL modules you must import from the index file.
 * This is to ensure that the XL modules are only loaded when
 * the application is not published as MIT.
 */
import * as XLMultiColumn from '@blocknote/xl-multi-column';

let modulesXL = undefined;
if (process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false') {
  modulesXL = XLMultiColumn;
}

type ModulesXL = typeof XLMultiColumn | undefined;

export default modulesXL as ModulesXL;
