import { create } from 'zustand';
import type { GameSession, GameRound } from '@song-quiz/shared';

interface ParticipantState {
  reactions: Array<{
    id: string;
    participantId: string;
    participantName: string;
    emoji: string;
    createdAt: number;
  }>;
  addReaction: (reaction: { id: string; participantId: string; participantName: string; emoji: string; createdAt: number }) => void;
  clearReactions: () => void;

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

  // Multiple choice state
  multipleChoiceOptions: string[];
  selectedAnswer: string | null;
  hasAnswered: boolean;
  setMultipleChoiceOptions: (options: string[]) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setHasAnswered: (answered: boolean) => void;

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
  reactions: [],
  participantId: null,
  participantName: '',
  sessionId: null,
  gameSession: null,
  currentRound: null,
  hasBuzzed: false,
  buzzerDisabled: false,
  multipleChoiceOptions: [],
  selectedAnswer: null,
  hasAnswered: false,
  myScore: 0,
  isConnected: false,
  error: null,

  addReaction: (reaction) =>
    set((state) => ({
      reactions: [...state.reactions.slice(-19), reaction],
    })),
  clearReactions: () => set({ reactions: [] }),

  // Actions
  setParticipantName: (name) => set({ participantName: name }),
  setParticipantId: (id) => set({ participantId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setGameSession: (session) => set({ gameSession: session }),
  setCurrentRound: (round) => set({ currentRound: round }),
  setBuzzed: (buzzed) => set({ hasBuzzed: buzzed }),
  setBuzzerDisabled: (disabled) => set({ buzzerDisabled: disabled }),
  setMultipleChoiceOptions: (options) => set({ multipleChoiceOptions: options }),
  setSelectedAnswer: (answer) => set({ selectedAnswer: answer }),
  setHasAnswered: (answered) => set({ hasAnswered: answered }),
  setMyScore: (score) => set({ myScore: score }),
  setConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      reactions: [],
      participantId: null,
      participantName: '',
      sessionId: null,
      gameSession: null,
      currentRound: null,
      hasBuzzed: false,
      buzzerDisabled: false,
      multipleChoiceOptions: [],
      selectedAnswer: null,
      hasAnswered: false,
      myScore: 0,
      isConnected: false,
      error: null,
    }),
}));
