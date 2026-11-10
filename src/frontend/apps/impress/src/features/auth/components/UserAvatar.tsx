import clsx from 'clsx';
import { renderToStaticMarkup } from 'react-dom/server';

import { userColorForeground, userColorsForId } from '../userColors';

import { AvatarSvg, AvatarSvgProps } from './AvatarSvg';

export const getColorFromName = (name: string) => userColorsForId(name).color;

export const getInitialFromName = (name: string) => {
  const splitName = name?.split(' ');
  return (splitName[0]?.charAt(0) || '?') + (splitName?.[1]?.charAt(0) || '');
};

type UserAvatarProps = {
  userId?: string;
  fullName?: string;
  background?: string;
} & Partial<Omit<AvatarSvgProps, 'initials' | 'background'>>;

export const UserAvatar = ({
  userId,
  fullName,
  background,
  className,
  foreground,
  ...props
}: UserAvatarProps) => {
  const name = fullName?.trim() || '?';
  const color = background || userColorsForId(userId ?? name).color;

  return (
    <AvatarSvg
      {...props}
      className={clsx('--docs--user-avatar', className)}
      initials={getInitialFromName(name).toUpperCase()}
      background={color}
      foreground={foreground ?? userColorForeground(color)}
    />
  );
};

export const avatarUrlFromName = (
  fullName?: string,
  fontFamily?: string,
  userId?: string,
): string => {
  const name = fullName?.trim() || '?';
  const initials = getInitialFromName(name).toUpperCase();
  const background = userColorsForId(userId ?? name).color;

  const svgMarkup = renderToStaticMarkup(
    <AvatarSvg
      className="--docs--user-avatar"
      initials={initials}
      background={background}
      foreground={userColorForeground(background)}
      fontFamily={fontFamily}
    />,
  );

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
};
