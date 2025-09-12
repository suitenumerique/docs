import React from 'react';

interface AvatarSvgProps {
  initials: string;
  background: string;
}

export const AvatarSvg: React.FC<AvatarSvgProps> = ({
  initials,
  background,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
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
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="10"
      fontWeight="600"
      fill="rgba(255,255,255,0.9)"
    >
      {initials}
    </text>
  </svg>
);
