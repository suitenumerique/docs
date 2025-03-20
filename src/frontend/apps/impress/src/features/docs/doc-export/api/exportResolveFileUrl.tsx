import { baseApiUrl } from '@/api';
import { Doc } from '@/features/docs/doc-management';

export const exportCorsResolveFileUrl = async (
  docId: Doc['id'],
  url: string,
) => {
  let resolvedUrl = url;
  // If the url is not from the same origin, better to proxy the request
  // to avoid CORS issues
  if (!url.includes(window.location.hostname) && !url.includes('base64')) {
    resolvedUrl = `${baseApiUrl()}documents/${docId}/cors-proxy/?url=${encodeURIComponent(url)}`;
  }

  return exportResolveFileUrl(resolvedUrl);
};

export const exportResolveFileUrl = async (url: string) => {
  try {
    const response = await fetch(url, {
      credentials: 'include',
    });

    return response.blob();
  } catch {
    console.error(`Failed to fetch image: ${url}`);
  }

  return url;
};
