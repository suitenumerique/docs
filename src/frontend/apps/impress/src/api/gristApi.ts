import { gristApiUrl } from './config';

export const gristFetchApi = async (input: string, init?: RequestInit) => {
  const apiUrl = `${gristApiUrl()}${input}`;
  const bearerToken = `Bearer ${process.env.NEXT_PUBLIC_GRIST_API_KEY}`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: bearerToken,
  };

  return await fetch(apiUrl, {
    ...init,
    headers,
  });
};
