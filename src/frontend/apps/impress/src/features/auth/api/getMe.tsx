import { fetchAPI } from '@/api';

import { User } from './types';

/**
 * Asynchronously retrieves the current user's data from the API.
 * This function is called during frontend initialization to check
 * the user's authentication status through a session cookie.
 *
 * @async
 * @function getMe
 * @throws {Error} Throws an error if the API request fails.
 * @returns {Promise<User>} A promise that resolves to the user data.
 */
export const getMe = async (): Promise<User> => {
  const response = await fetchAPI(`users/me/`);
  if (!response.ok) {
    throw new Error(`Couldn't fetch user data: ${response.statusText}`);
  }
  return response.json() as Promise<User>;
};
