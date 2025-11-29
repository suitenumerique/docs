import React from 'react';

import { Box, BoxType } from '@/components';

type AvatarSvgProps = {
  initials: string;
  background: string;
  fontFamily?: string;
} & BoxType;

export const AvatarSvg: React.FC<AvatarSvgProps> = ({
  initials,
  background,
  fontFamily,
  ...props
}) => (
  <Box
    as="svg"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <rect
      x="0.5"
      y="0.5"
      width="23"
      height="23"
      rx="11.5"
      ry="11.5"
      fill={background}
      stroke="rgba(255,255,255,0.5)"
      strokeWidth="1"
    />
    <text
      x="50%"
      y="50%"
      dy="0.35em"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
      fill="rgba(255,255,255,0.9)"
      fontFamily={fontFamily || 'Arial'}
    >
      {initials}
    </text>
  </Box>
);
