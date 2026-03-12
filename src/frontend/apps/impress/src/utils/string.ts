export const isValidEmail = (email: string) => {
  const EMAIL_REGEX =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z\-0-9]{2,}))$/;
  return EMAIL_REGEX.test(email);
};

export const toBase64 = (str: Uint8Array): string =>
  Buffer.from(str).toString('base64');
