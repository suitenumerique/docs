import { css } from 'styled-components';

import { Box } from '@/components';
import { User } from '@/core';
import { tokens } from '@/cunningham';

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

type Props = {
  user: User;
  background?: string;
};

export const UserAvatar = ({ user, background }: Props) => {
  const name = user.full_name || user.email || '?';
  const splitName = name?.split(' ');

  return (
    <Box
      $background={background || getColorFromName(name)}
      $width="24px"
      $height="24px"
      $direction="row"
      $align="center"
      $justify="center"
      $radius="50%"
      $css={css`
        color: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.5);
      `}
    >
      <Box
        $direction="row"
        $css={css`
          text-align: center;
          font-style: normal;
          font-weight: 600;
          font-family: Arial, Helvetica, sans-serif; // Can't use marianne font because it's impossible to center with this font
          font-size: 10px;
          text-transform: uppercase;
        `}
      >
        {splitName[0]?.charAt(0)}
        {splitName?.[1]?.charAt(0)}
      </Box>
    </Box>
  );
};
