import { create } from 'zustand';

interface Song {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  spotifyUri: string;
  previewUrl?: string;
  durationMs?: number;
  // Backend format
  answer?: {
    title: string;
    artist: string;
  };
  metadata?: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
  };
}

interface GameSession {
  id: string;
  status: string;
  songs: Song[];
  rounds?: Array<{
    id: string;
    isComplete: boolean;
    winnerId?: string;
    songStartOffset?: number;
  }>;
  participantIds: string[];
  participants?: Array<{ id: string; name: string }>;
  scores: Record<string, number>;
  currentRoundIndex: number;
  settings: {
    songDuration: number;
    numberOfSongs: number;
  };
}

interface Playlist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  tracks: { total: number };
}

interface AppState {
  // Auth
  accessToken: string | null;
  isAuthenticated: boolean;

  // Data
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  songs: Song[];
  gameSession: GameSession | null;

  // Actions
  setAccessToken: (token: string | null) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  setSongs: (songs: Song[]) => void;
  setGameSession: (session: GameSession | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  accessToken: null,
  isAuthenticated: false,
  playlists: [],
  selectedPlaylist: null,
  songs: [],
  gameSession: null,

  // Actions
  setAccessToken: (token) => set({ accessToken: token, isAuthenticated: !!token }),
  setPlaylists: (playlists) => set({ playlists }),
  setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  setSongs: (songs) => set({ songs }),
  setGameSession: (session) => set({ gameSession: session }),
  reset: () => set({
    accessToken: null,
    isAuthenticated: false,
    playlists: [],
    selectedPlaylist: null,
    songs: [],
    gameSession: null,
  }),
}));

export type { Song, GameSession, Playlist };
