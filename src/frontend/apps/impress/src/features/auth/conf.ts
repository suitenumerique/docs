import { baseApiUrl } from '@/api';

export const HOME_URL = '/home';
export const LOGIN_URL = `${baseApiUrl()}authenticate/`;
export const LOGOUT_URL = `${baseApiUrl()}logout/`;
export const PATH_AUTH_LOCAL_STORAGE = 'docs-path-auth';
