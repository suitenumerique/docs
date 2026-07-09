import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CLASS_DOC_TITLE } from '@/docs/doc-header/components/DocTitle';
import { getEmojiAndTitle, useDocStore, useTrans } from '@/docs/doc-management';
import {
  LeftPanelCollapseButton,
  useLeftPanelStore,
} from '@/features/left-panel';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

export const DocLeftPanelCollapseButton = () => {
  const { t } = useTranslation();
  const { isPanelOpen } = useLeftPanelStore();
  const { currentDoc } = useDocStore();
  const [isDocTitleVisible, setIsDocTitleVisible] = useState(true);
  const [isDocTitleInDom, setIsDocTitleInDom] = useState(true);

  /**
   * CLASS_DOC_TITLE is not every time in the DOM when
   * this component is rendered, we need to observe the DOM
   * to know when it is added, then we can observe
   * its visibility.
   */
  useEffect(() => {
    setIsDocTitleInDom(false);

    const docTitleEl = document.querySelector(`.${CLASS_DOC_TITLE}`);
    if (docTitleEl) {
      setIsDocTitleInDom(true);
      return;
    }

    const mutationObserver = new MutationObserver(() => {
      if (document.querySelector(`.${CLASS_DOC_TITLE}`)) {
        mutationObserver.disconnect();
        setIsDocTitleInDom(true);
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
    };
  }, [currentDoc?.id]);

  /**
   * When the doc title is in the DOM, we observe its
   * visibility to show or hide the collapse button accordingly
   */
  useEffect(() => {
    if (!isDocTitleInDom || isPanelOpen) {
      return;
    }

    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    const docTitleEl = document.querySelector(`.${CLASS_DOC_TITLE}`);

    if (!mainContent || !docTitleEl) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsDocTitleVisible(entry.isIntersecting);
      },
      {
        root: mainContent,
        threshold: 0.05,
      },
    );

    observer.observe(docTitleEl);

    return () => {
      observer.disconnect();
      setIsDocTitleVisible(true);
    };
  }, [isDocTitleInDom, isPanelOpen]);

  const { untitledDocument } = useTrans();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
    currentDoc?.title ?? '',
  );
  const docTitle = titleWithoutEmoji || untitledDocument;
  const buttonTitle = emoji ? `${emoji} ${docTitle}` : docTitle;
  const shouldShowButtonTitle = !isPanelOpen && !isDocTitleVisible;
  const ariaLabel = isPanelOpen
    ? t('Hide the side panel for {{title}}', { title: docTitle })
    : t('Show the side panel for {{title}}', { title: docTitle });

  return (
    <LeftPanelCollapseButton
      ariaLabel={ariaLabel}
      buttonTitle={shouldShowButtonTitle ? buttonTitle : undefined}
    />
  );
};
