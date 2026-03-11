import { MAIN_LAYOUT_ID } from './conf';

export const getMainContentElement = (): HTMLElement | null =>
  document.getElementById(MAIN_LAYOUT_ID) ??
  document.getElementsByTagName('main')[0] ??
  null;

export const getMainContentFocusTarget = (): HTMLElement | null => {
  const mainContent = getMainContentElement();

  if (!mainContent) {
    return null;
  }

  const firstHeading =
    mainContent.querySelector('h1') ?? mainContent.querySelector('h2');

  return firstHeading instanceof HTMLElement ? firstHeading : mainContent;
};

export const focusMainContentStart = (
  options?: FocusOptions,
): HTMLElement | null => {
  const focusTarget = getMainContentFocusTarget();

  if (!focusTarget) {
    return null;
  }

  if (!focusTarget.hasAttribute('tabindex')) {
    focusTarget.setAttribute('tabindex', '-1');
  }

  focusTarget.focus(options);

  return focusTarget;
};
