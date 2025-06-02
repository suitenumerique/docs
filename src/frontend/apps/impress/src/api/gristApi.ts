import { gristApiUrl } from './config';

export const gristFetchApi = async (input: string, init?: RequestInit) => {
  const apiUrl = `${gristApiUrl()}${input}`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer 26c3446a0165be92f25cacbda4cff1a18ef42d59`,
  };

  return await fetch(apiUrl, {
    ...init,
    headers,
  });
};
