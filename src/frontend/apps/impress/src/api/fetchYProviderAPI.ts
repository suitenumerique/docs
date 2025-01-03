const baseYProviderUrl = () => {
  return process.env.NEXT_PUBLIC_Y_PROVIDER_API_BASE_URL || 'http://localhost:4444/api/';
};

export const fetchYProvider = async (
  input: string,
  init?: RequestInit,
) => {
  const apiUrl = `${baseYProviderUrl()}${input}`;
  const apiKey = process.env.NEXT_PUBLIC_Y_PROVIDER_API_KEY || 'yprovider-api-key';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': apiKey,
    ...init?.headers,
  };

  const response = await fetch(apiUrl, {
    ...init,
    headers,
  });

  return response;
};

interface ConversionResponse {
  content: string;
}

export const convertMarkdownToY = async (content: string): Promise<string> => {
  const response = await fetchYProvider('convert-markdown', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to convert markdown');
  }

  const data = (await response.json()) as ConversionResponse;
  return data.content;
};
