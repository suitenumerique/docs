export interface UserToken {
  digest: string;
  created: string; // Assuming ISO date string
  expiry: string; // Assuming ISO date string
}

export interface NewUserToken extends UserToken {
  token_key: string;
}
