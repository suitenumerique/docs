export const isFirefox = () =>
  navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const isMacOS =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
