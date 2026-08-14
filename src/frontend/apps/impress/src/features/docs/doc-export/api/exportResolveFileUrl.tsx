import { baseApiUrl } from '@/api';
import { Doc } from '@/features/docs/doc-management';
import { isDataUrl, isLocalDevOrigin, isSameOrigin } from '@/utils/url';

export const exportCorsResolveFileUrl = async (
  docId: Doc['id'],
  url: string,
) => {
  let resolvedUrl = url;

  // data: urls are already embedded, there is nothing to fetch remotely.
  // Anything else that is not from the same origin (or, in local dev, the
  // same localhost host on a different port) is proxied to avoid CORS
  // issues.
  if (!isDataUrl(url) && !isSameOrigin(url) && !isLocalDevOrigin(url)) {
    resolvedUrl = `${baseApiUrl()}documents/${docId}/cors-proxy/?url=${encodeURIComponent(url)}`;
  }

  return exportResolveFileUrl(resolvedUrl);
};

export const exportResolveFileUrl = async (url: string) => {
  try {
    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

    return response.blob();
  } catch (error) {
    console.error(`Failed to fetch image: ${url}`, error);
  }

  return url;
};
