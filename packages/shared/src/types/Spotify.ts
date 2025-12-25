export interface SpotifyAuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string; height?: number; width?: number }>;
  tracks: {
    total: number;
  };
  owner: {
    id: string;
    display_name: string;
  };
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images: Array<{ url: string }>;
}

export interface SpotifyAuthRequest {
  code: string;
  redirectUri: string;
}

export interface SpotifyAuthResponse {
  tokens: SpotifyAuthTokens;
  user: SpotifyUser;
}
