export const isValidEmail = (email: string) => {
  const EMAIL_REGEX =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z\-0-9]{2,}))$/;
  return EMAIL_REGEX.test(email);
};

export const toBase64 = (str: Uint8Array): string =>
  Buffer.from(str).toString('base64');

const FILE_SIZE_UNITS = ['bytes', 'KB', 'MB', 'GB'] as const;

/**
 * Turn a number of bytes into a short human readable size, e.g. `10MB`.
 * Kept unit-suffixed without a space to match the wording of the size limit messages.
 */
export const formatFileSize = (bytes: number): string => {
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${Math.round(size * 10) / 10}${FILE_SIZE_UNITS[unitIndex]}`;
};
