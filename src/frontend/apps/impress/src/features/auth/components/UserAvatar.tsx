import { renderToStaticMarkup } from 'react-dom/server';

import { tokens } from '@/cunningham';

import { AvatarSvg } from './AvatarSvg';

const colors = tokens.themes.default.theme.colors;

const avatarsColors = [
  colors['blue-500'],
  colors['brown-500'],
  colors['cyan-500'],
  colors['gold-500'],
  colors['green-500'],
  colors['olive-500'],
  colors['orange-500'],
  colors['pink-500'],
  colors['purple-500'],
  colors['yellow-500'],
];

const getColorFromName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarsColors[Math.abs(hash) % avatarsColors.length];
};

const getInitialFromName = (name: string) => {
  const splitName = name?.split(' ');
  return (splitName[0]?.charAt(0) || '?') + (splitName?.[1]?.charAt(0) || '');
};

type UserAvatarProps = {
  fullName?: string;
  background?: string;
};

export const UserAvatar = ({ fullName, background }: UserAvatarProps) => {
  const name = fullName?.trim() || '?';

  return (
    <AvatarSvg
      className="--docs--user-avatar"
      initials={getInitialFromName(name).toUpperCase()}
      background={background || getColorFromName(name)}
    />
  );
};

export const avatarUrlFromName = (
  fullName?: string,
  fontFamily?: string,
): string => {
  const name = fullName?.trim() || '?';
  const initials = getInitialFromName(name).toUpperCase();
  const background = getColorFromName(name);

  const svgMarkup = renderToStaticMarkup(
    <AvatarSvg
      className="--docs--user-avatar"
      initials={initials}
      background={background}
      fontFamily={fontFamily}
    />,
  );

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
};
