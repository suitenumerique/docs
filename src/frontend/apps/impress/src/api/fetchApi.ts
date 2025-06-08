import { baseApiUrl } from './config';
import { getCSRFToken } from './utils';

interface FetchAPIInit extends RequestInit {
  withoutContentType?: boolean;
}

export const fetchAPI = async (
  input: string,
  init?: FetchAPIInit,
  apiVersion = '1.0',
) => {
  const apiUrl = `${baseApiUrl(apiVersion)}${input}`;
  const csrfToken = getCSRFToken();

  const headers = {
    'Content-Type': 'application/json',
    ...init?.headers,
    ...(csrfToken && { 'X-CSRFToken': csrfToken }),
  };

  if (init?.withoutContentType) {
    delete headers?.['Content-Type' as keyof typeof headers];
  }

  return await fetch(apiUrl, {
    ...init,
    credentials: 'include',
    headers,
  });
};
