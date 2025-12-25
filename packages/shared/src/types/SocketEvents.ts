import { GameSession } from './GameSession';
import { Participant } from './Participant';
import { BuzzerEvent } from './BuzzerEvent';

// Client -> Server Events
export interface ClientToServerEvents {
  join_game: (data: { sessionId: string; participantName: string }, callback: (response: { success: boolean; participant?: Participant; error?: string }) => void) => void;
  join_session_as_master: (data: { sessionId: string }) => void;
  leave_game: (data: { sessionId: string }) => void;
  buzzer_pressed: (data: { sessionId: string }, callback: (response: { success: boolean; buzzerEvent?: BuzzerEvent; error?: string }) => void) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  game_state_update: (data: { session: GameSession }) => void;
  participant_joined: (data: { participant: Participant }) => void;
  participant_left: (data: { participantId: string }) => void;
  participant_reconnected: (data: { participantId: string }) => void;
  buzzer_event: (data: { buzzerEvent: BuzzerEvent; position: number }) => void;
  song_started: (data: { roundId: string; songStartTime: number; duration: number }) => void;
  round_ended: (data: { roundId: string; winnerId?: string; winnerName?: string; correctAnswer: { title: string; artist: string } }) => void;
  score_update: (data: { scores: Record<string, number> }) => void;
  game_ended: (data: { finalScores: Array<{ participantId: string; participantName: string; score: number }>; winnerId?: string }) => void;
  error: (data: { message: string }) => void;
}

// Inter-server Events (for future scaling)
export interface InterServerEvents {
  ping: () => void;
}

// Socket Data
export interface SocketData {
  participantId?: string;
  sessionId?: string;
}
