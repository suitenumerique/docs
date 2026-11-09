import { getColorFromName, getInitialFromName } from '@/features/auth';

// Drawn at twice the displayed size, so the avatar stays sharp when printed.
const AVATAR_PIXELS = 48;

/**
 * The avatar of a mentioned user as a PNG data URL, the same as the one of the
 * editor: a disc of the color of the name with its initials. The exported
 * documents cannot embed the SVG, a raster image is the only format all of
 * them support, and the inline content mappings are synchronous, so it is
 * drawn straight on a canvas.
 * Returns `undefined` when no canvas is available, the callers then export the
 * name only.
 */
export const getUserMentionAvatarPng = (
  fullName: string,
): string | undefined => {
  const name = fullName.trim() || '?';
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return undefined;
  }

  const center = AVATAR_PIXELS / 2;

  ctx.fillStyle = getColorFromName(name);
  ctx.beginPath();
  ctx.arc(center, center, center, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = '600 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getInitialFromName(name).toUpperCase(), center, center + 1);

  return canvas.toDataURL('image/png');
};

export const dataUrlToBytes = (dataUrl: string): Uint8Array =>
  Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0));
