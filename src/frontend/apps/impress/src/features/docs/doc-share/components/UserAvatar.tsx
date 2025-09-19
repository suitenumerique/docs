import { css } from 'styled-components';

import { Text } from '@/components';
import { tokens } from '@/cunningham';
import { User } from '@/features/auth';

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
    <Text
      className="--docs--user-avatar"
      $align="center"
      $color="rgba(255, 255, 255, 0.9)"
      $justify="center"
      $background={background || getColorFromName(name)}
      $width="24px"
      $height="24px"
      $radius="50%"
      $size="10px"
      $textAlign="center"
      $textTransform="uppercase"
      $weight={600}
      $css={css`
        border: 1px solid rgba(255, 255, 255, 0.5);
        contain: content;
      `}
    >
      {splitName[0]?.charAt(0)}
      {splitName?.[1]?.charAt(0)}
    </Text>
  );
};
