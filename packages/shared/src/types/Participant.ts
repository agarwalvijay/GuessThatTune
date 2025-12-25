export interface Participant {
  id: string;
  name: string;
  sessionId: string;
  score: number;
  joinedAt: string;
  socketId: string;
  isConnected: boolean;
}

export interface ParticipantState {
  hasAnswered: boolean;
  currentRoundScore?: number;
}
