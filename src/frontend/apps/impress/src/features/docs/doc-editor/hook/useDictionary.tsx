import * as locales from '@blocknote/core/locales';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useModuleDictionnaryAI } from '../components/AI';

export const useDictionary = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const aiDictionary = useModuleDictionnaryAI();
  const [dictionary, setDictionary] = useState(() => ({
    ...locales[lang as keyof typeof locales],
  }));

  useEffect(() => {
    if (!aiDictionary) {
      setDictionary((dictionary) => ({
        ...dictionary,
      }));
      return;
    }

    setDictionary((dictionary) => ({
      ...dictionary,
      ...aiDictionary,
    }));
  }, [aiDictionary]);

  return dictionary;
};
