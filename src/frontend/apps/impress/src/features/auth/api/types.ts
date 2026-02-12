/**
 * Represents user retrieved from the API.
 * @interface User
 * @property {string} id - The id of the user.
 * @property {string} email - The email of the user.
 * @property {string} name - The name of the user.
 * @property {string} encryptionPublicKey - The user public key if encryption onboarding has been done.
 * @property {string} language - The language of the user. e.g. 'en-us', 'fr-fr', 'de-de'.
 */
export interface User {
  id: string;
  email: string;
  full_name: string;
  short_name: string;
  encryptionPublicKey: string | null;
  language?: string;
}

export type UserLight = Pick<User, 'full_name' | 'short_name'>;
