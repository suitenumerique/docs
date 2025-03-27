import { IncomingHttpHeaders } from 'http';

import axios from 'axios';

import { COLLABORATION_BACKEND_BASE_URL } from '@/env';

export interface User {
  id: string;
  email: string;
  full_name: string;
  short_name: string;
  language: string;
}

export const getMe = async (requestHeaders: IncomingHttpHeaders) => {
  const response = await axios.get<User>(
    `${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/users/me/`,
    {
      headers: {
        Cookie: requestHeaders['cookie'],
        Origin: requestHeaders['origin'],
      },
    },
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }

  return response.data;
};
