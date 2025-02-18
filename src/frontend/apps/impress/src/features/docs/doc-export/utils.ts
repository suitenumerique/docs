export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const exportResolveFileUrl = async (
  url: string,
  resolveFileUrl: ((url: string) => Promise<string | Blob>) | undefined,
) => {
  if (!url.includes(window.location.hostname) && resolveFileUrl) {
    return resolveFileUrl(url);
  }

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
