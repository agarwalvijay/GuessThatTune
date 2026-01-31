import { Song } from './Song';
import { BuzzerEvent } from './BuzzerEvent';

export type GameStatus = 'waiting' | 'playing' | 'paused' | 'ended';

export interface GameSettings {
  songDuration: number; // Max duration to play each song (seconds)
  maxScore: number; // Maximum points per question (default: 60)
  randomStartOffset: boolean; // Whether to start songs at random positions
  negativePointsPercentage: number; // Percentage of potential points to deduct for wrong answers (default: 25)
}

export interface GameRound {
  id: string;
  songId: string;
  songStartTime?: number; // Server timestamp when song started playing
  songStartOffset?: number; // Offset in seconds where song started
  buzzerEvents: BuzzerEvent[];
  winnerId?: string; // Participant who answered correctly
  winnerScore?: number; // Points awarded
  isComplete: boolean;
}

export interface GameSession {
  id: string;
  status: GameStatus;
  songs: Song[];
  currentRoundIndex: number;
  rounds: GameRound[];
  participantIds: string[]; // Array of participant IDs
  participants?: Array<{ id: string; name: string; isConnected: boolean }>; // Full participant details
  scores: Record<string, number>; // participantId -> total score
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  settings: GameSettings;
  spotifyAccessToken?: string; // Spotify access token for this session
  spotifyPlaylistId?: string; // Source playlist ID
}

export interface CreateGameSessionRequest {
  songs: Song[];
  settings?: Partial<GameSettings>;
}

export interface JoinGameRequest {
  sessionId: string;
  participantName: string;
}
