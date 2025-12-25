export interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  year?: number;
  genre?: string;
  imageUrl?: string; // Album artwork
}

export interface SpotifyTrack {
  id: string; // Spotify track ID
  uri: string; // Spotify URI (spotify:track:xxx)
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  preview_url?: string;
}

export interface Song {
  id: string;
  spotifyTrackId: string; // Spotify track ID
  spotifyUri: string; // Spotify URI for playback
  metadata: SongMetadata;
  answer: {
    title: string;
    artist: string;
  };
  previewUrl?: string; // 30-second preview URL (fallback)
}
