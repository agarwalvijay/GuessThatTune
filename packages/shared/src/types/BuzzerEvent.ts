export interface BuzzerEvent {
  id: string;
  participantId: string;
  participantName: string;
  sessionId: string;
  roundId: string;
  buzzerTime: number; // Server timestamp when buzzer was pressed
  songStartTime: number; // Server timestamp when song started
  elapsedSeconds: number; // Time since song started (in seconds)
  score?: number; // Calculated score if answer was correct
  isCorrect?: boolean; // Whether the answer was marked correct
}
