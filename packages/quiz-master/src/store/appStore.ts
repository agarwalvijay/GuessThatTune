import { create } from 'zustand';
import { SpotifyPlaylist, Song, SpotifyUser, GameSession } from '@song-quiz/shared';

interface AppState {
  // Spotify Auth
  isAuthenticated: boolean;
  spotifyUser: SpotifyUser | null;
  setAuthenticated: (isAuth: boolean, user?: SpotifyUser) => void;

  // Playlists
  playlists: SpotifyPlaylist[];
  selectedPlaylist: SpotifyPlaylist | null;
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
  selectPlaylist: (playlist: SpotifyPlaylist) => void;

  // Songs
  songs: Song[];
  setSongs: (songs: Song[]) => void;

  // Game Session
  gameSession: GameSession | null;
  setGameSession: (session: GameSession | null) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset store
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isAuthenticated: false,
  spotifyUser: null,
  playlists: [],
  selectedPlaylist: null,
  songs: [],
  gameSession: null,
  isLoading: false,
  error: null,

  // Actions
  setAuthenticated: (isAuth, user) =>
    set({ isAuthenticated: isAuth, spotifyUser: user || null }),

  setPlaylists: (playlists) =>
    set({ playlists }),

  selectPlaylist: (playlist) =>
    set({ selectedPlaylist: playlist }),

  setSongs: (songs) =>
    set({ songs }),

  setGameSession: (session) =>
    set({ gameSession: session }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set({
      isAuthenticated: false,
      spotifyUser: null,
      playlists: [],
      selectedPlaylist: null,
      songs: [],
      gameSession: null,
      isLoading: false,
      error: null,
    }),
}));
