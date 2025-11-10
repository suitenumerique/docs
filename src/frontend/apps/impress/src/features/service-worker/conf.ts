import pkg from '@/../package.json';

export const SW_DEV_URL = [
  'http://localhost:3000',
  'https://impress.127.0.0.1.nip.io',
];

export const SW_DEV_API = 'http://localhost:8071';
export const SW_VERSION = `v-${process.env.NEXT_PUBLIC_BUILD_ID}`;
export const DAYS_EXP = 5;

export const getCacheNameVersion = (cacheName: string) =>
  `${pkg.name}-${cacheName}-${SW_VERSION}`;

export const MESSAGE_TYPE = {
  OFFLINE: 'OFFLINE',
};
