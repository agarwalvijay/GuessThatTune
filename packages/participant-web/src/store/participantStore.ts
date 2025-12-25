import { create } from 'zustand';
import type { GameSession, GameRound } from '@song-quiz/shared';

interface ParticipantState {
  // Participant info
  participantId: string | null;
  participantName: string;
  setParticipantName: (name: string) => void;
  setParticipantId: (id: string) => void;

  // Session info
  sessionId: string | null;
  gameSession: GameSession | null;
  setSessionId: (id: string) => void;
  setGameSession: (session: GameSession | null) => void;

  // Current round
  currentRound: GameRound | null;
  setCurrentRound: (round: GameRound | null) => void;

  // Buzzer state
  hasBuzzed: boolean;
  buzzerDisabled: boolean;
  setBuzzed: (buzzed: boolean) => void;
  setBuzzerDisabled: (disabled: boolean) => void;

  // Scores
  myScore: number;
  setMyScore: (score: number) => void;

  // Connection state
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

export const useParticipantStore = create<ParticipantState>((set) => ({
  // Initial state
  participantId: null,
  participantName: '',
  sessionId: null,
  gameSession: null,
  currentRound: null,
  hasBuzzed: false,
  buzzerDisabled: false,
  myScore: 0,
  isConnected: false,
  error: null,

  // Actions
  setParticipantName: (name) => set({ participantName: name }),
  setParticipantId: (id) => set({ participantId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setGameSession: (session) => set({ gameSession: session }),
  setCurrentRound: (round) => set({ currentRound: round }),
  setBuzzed: (buzzed) => set({ hasBuzzed: buzzed }),
  setBuzzerDisabled: (disabled) => set({ buzzerDisabled: disabled }),
  setMyScore: (score) => set({ myScore: score }),
  setConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      participantId: null,
      participantName: '',
      sessionId: null,
      gameSession: null,
      currentRound: null,
      hasBuzzed: false,
      buzzerDisabled: false,
      myScore: 0,
      isConnected: false,
      error: null,
    }),
}));
