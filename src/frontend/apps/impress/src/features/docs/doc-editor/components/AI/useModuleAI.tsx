import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const modulesAGPL =
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./libAGPL')
    : Promise.resolve(null);

export const useModuleAI = () => {
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

export const useModuleDictionnaryAI = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  const [dictionary, setDictionary] = useState(() => ({
    ai: {},
  }));

  useEffect(() => {
    const resolveModule = async () => {
      const resolvedModules = await modulesAGPL;
      if (!resolvedModules) {
        return;
      }

      const { localesAI } = resolvedModules;

      setDictionary({
        ai: localesAI[lang as keyof typeof localesAI],
      });
    };

    void resolveModule();
  }, [lang]);

  return dictionary;
};
