import { useEffect, useState } from 'react';

const modulesAGPL =
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('../libAGPL')
    : Promise.resolve(null);

export const useModuleExport = () => {
  const [modules, setModules] = useState<Awaited<typeof modulesAGPL>>();

  useEffect(() => {
    const resolveModule = async () => {
      const resolvedModules = await modulesAGPL;
      if (!resolvedModules) {
        return;
      }
      setModules(resolvedModules);
    };
    void resolveModule();
  }, []);

  return modules;
};
