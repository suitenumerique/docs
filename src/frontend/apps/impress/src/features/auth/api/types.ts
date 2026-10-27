/**
 * Represents user retrieved from the API.
 * @interface User
 * @property {string} id - The id of the user.
 * @property {string} email - The email of the user.
 * @property {string} full_name - The full name of the user.
 * @property {string} language - The language of the user. e.g. 'en-us', 'fr-fr', 'de-de'.
 */
export interface User {
  id: string;
  is_first_connection: boolean;
  suite_user_id: string | null;
  email: string;
  full_name: string;
  short_name: string;
  language?: string;
}

export type UserLight = Pick<User, 'full_name' | 'short_name'>;
