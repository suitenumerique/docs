import { gristApiUrl } from './config';

export const gristFetchApi = async (input: string, init?: RequestInit) => {
  const apiUrl = `${gristApiUrl()}${input}`;
  const apiKey = localStorage.getItem('grist_api_key');
  const bearerToken = `Bearer ${apiKey}`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: bearerToken,
  };

  return await fetch(apiUrl, {
    ...init,
    headers,
  });
};
