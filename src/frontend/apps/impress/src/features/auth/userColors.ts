// Seed one hue per identity. Use a readable dark shade for text/cursors and
// the original pastel shade for author highlights.
export const userColorsForId = (id: string) => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }

  const nextInt = (min: number, max: number) => {
    hash = (hash + 0x6d2b79f5) | 0;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    const fraction = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    return min + Math.floor(fraction * (max - min + 1));
  };

  const hue = nextInt(0, 360);
  const saturation = nextInt(42, 98);
  const lightness = nextInt(70, 90);
  const colorLight = hslToHex(hue, saturation, lightness);
  const lightLuminance = relativeLuminance(colorLight);
  let darkLightness = 40;
  let color = hslToHex(hue, saturation, darkLightness);

  // Yellow/green hues need more darkening than blue to keep text readable.
  while (
    darkLightness > 1 &&
    (lightLuminance + 0.05) / (relativeLuminance(color) + 0.05) < 4.5
  ) {
    color = hslToHex(hue, saturation, --darkLightness);
  }

  return {
    color,
    colorLight,
  };
};

// Same relative-luminance threshold as BlockNote's default cursor renderer.
export const userColorForeground = (background: string) =>
  relativeLuminance(background) <= 0.179 ? '#ffffff' : '#000000';

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
