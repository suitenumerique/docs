export const isFirefox = () =>
  navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const isEdge = () =>
  navigator.userAgent.toLowerCase().indexOf('edg') > -1;
