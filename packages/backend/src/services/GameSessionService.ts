import { randomUUID } from 'crypto';
import {
  GameSession,
  GameRound,
  Participant,
  BuzzerEvent,
  Song,
  CreateGameSessionRequest,
  DEFAULT_GAME_SETTINGS,
  calculateScore,
  getRandomStartOffset,
} from '@song-quiz/shared';

export class GameSessionService {
  private sessions: Map<string, GameSession> = new Map();
  private participants: Map<string, Participant> = new Map();
  private buzzerRateLimits: Map<string, number> = new Map();

  /**
   * Generate a unique 5-character session code
   */
  private generateSessionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: 0, O, 1, I
    let code: string;

    // Keep generating until we find a unique code
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.sessions.has(code));

    return code;
  }

  /**
   * Normalize session ID to uppercase for case-insensitive lookups
   */
  private normalizeSessionId(sessionId: string): string {
    return sessionId.toUpperCase();
  }

  /**
   * Create a new game session
   */
  createSession(request: CreateGameSessionRequest): GameSession {
    const sessionId = this.generateSessionCode();

    const session: GameSession = {
      id: sessionId,
      status: 'waiting',
      songs: request.songs,
      currentRoundIndex: -1, // No round started yet
      rounds: [],
      participantIds: [],
      scores: {},
      createdAt: new Date().toISOString(),
      settings: {
        ...DEFAULT_GAME_SETTINGS,
        ...request.settings,
      },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): GameSession | undefined {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) return undefined;

    // Populate participants array with names
    const participants = session.participantIds.map(id => {
      const participant = this.participants.get(id);
      return {
        id,
        name: participant?.name || 'Unknown',
        isConnected: participant?.isConnected || false,
      };
    });

    return {
      ...session,
      participants,
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Add a participant to a session
   */
  addParticipant(sessionId: string, participantName: string, socketId: string): Participant | null {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return null;
    }

    const participantId = randomUUID();
    const participant: Participant = {
      id: participantId,
      name: participantName,
      sessionId,
      score: 0,
      joinedAt: new Date().toISOString(),
      socketId,
      isConnected: true,
    };

    this.participants.set(participantId, participant);
    session.participantIds.push(participantId);
    session.scores[participantId] = 0;

    return participant;
  }

  /**
   * Remove a participant from a session
   */
  removeParticipant(participantId: string): void {
    const participant = this.participants.get(participantId);
    if (!participant) {
      return;
    }

    const session = this.sessions.get(participant.sessionId);
    if (session) {
      session.participantIds = session.participantIds.filter(id => id !== participantId);
      delete session.scores[participantId];
    }

    this.participants.delete(participantId);
  }

  /**
   * Get participant by ID
   */
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Get participant by socket ID
   */
  getParticipantBySocketId(socketId: string): Participant | undefined {
    return Array.from(this.participants.values()).find(p => p.socketId === socketId);
  }

  /**
   * Update participant socket ID (for reconnections)
   */
  updateParticipantSocketId(participantId: string, newSocketId: string): void {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.socketId = newSocketId;
      participant.isConnected = true;
    }
  }

  /**
   * Start the game
   */
  startGame(sessionId: string): GameRound | null {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session || session.songs.length === 0) {
      return null;
    }

    session.status = 'playing';
    session.startedAt = new Date().toISOString();

    // Start first round
    return this.startNextRound(normalizedId);
  }

  /**
   * Start the next round
   */
  startNextRound(sessionId: string): GameRound | null {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return null;
    }

    const nextRoundIndex = session.currentRoundIndex + 1;

    // Check if game is complete
    if (nextRoundIndex >= session.songs.length) {
      this.endGame(normalizedId);
      return null;
    }

    const song = session.songs[nextRoundIndex];
    const songStartOffset = session.settings.randomStartOffset
      ? getRandomStartOffset(song.metadata.duration)
      : 0;

    const round: GameRound = {
      id: randomUUID(),
      songId: song.id,
      songStartTime: Date.now(),
      songStartOffset,
      buzzerEvents: [],
      isComplete: false,
    };

    session.rounds.push(round);
    session.currentRoundIndex = nextRoundIndex;

    return round;
  }

  /**
   * Handle buzzer press
   */
  handleBuzzerPress(sessionId: string, participantId: string): BuzzerEvent | null {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    const participant = this.participants.get(participantId);

    if (!session || !participant) {
      return null;
    }

    // Check if game is playing
    if (session.status !== 'playing') {
      return null;
    }

    // Get current round
    const currentRound = session.rounds[session.currentRoundIndex];
    if (!currentRound || !currentRound.songStartTime) {
      return null;
    }

    // Check rate limiting (prevent spam)
    const lastBuzzTime = this.buzzerRateLimits.get(participantId) || 0;
    const now = Date.now();
    if (now - lastBuzzTime < 1000) { // 1 second rate limit
      return null;
    }
    this.buzzerRateLimits.set(participantId, now);

    // Check if participant already buzzed in this round
    const alreadyBuzzed = currentRound.buzzerEvents.some(
      event => event.participantId === participantId
    );
    if (alreadyBuzzed) {
      return null;
    }

    // Create buzzer event
    const elapsedMs = now - currentRound.songStartTime;
    const elapsedSeconds = elapsedMs / 1000;

    const buzzerEvent: BuzzerEvent = {
      id: randomUUID(),
      participantId,
      participantName: participant.name,
      sessionId,
      roundId: currentRound.id,
      buzzerTime: now,
      songStartTime: currentRound.songStartTime,
      elapsedSeconds,
    };

    currentRound.buzzerEvents.push(buzzerEvent);

    return buzzerEvent;
  }

  /**
   * Mark answer as correct and award points
   */
  markAnswerCorrect(sessionId: string, roundId: string, participantId: string): number {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return 0;
    }

    const round = session.rounds.find(r => r.id === roundId);
    if (!round) {
      return 0;
    }

    const buzzerEvent = round.buzzerEvents.find(e => e.participantId === participantId);
    if (!buzzerEvent) {
      return 0;
    }

    // Calculate score
    const score = calculateScore(buzzerEvent.elapsedSeconds);
    buzzerEvent.score = score;
    buzzerEvent.isCorrect = true;

    // Update participant total score
    session.scores[participantId] = (session.scores[participantId] || 0) + score;

    // Mark round as complete
    round.isComplete = true;
    round.winnerId = participantId;
    round.winnerScore = score;

    return score;
  }

  /**
   * Mark answer as incorrect and deduct points
   */
  markAnswerIncorrect(sessionId: string, roundId: string, participantId: string): number {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return 0;
    }

    const round = session.rounds.find(r => r.id === roundId);
    if (!round) {
      return 0;
    }

    const buzzerEvent = round.buzzerEvents.find(e => e.participantId === participantId);
    if (!buzzerEvent) {
      return 0;
    }

    // Calculate what the score would have been if correct
    const potentialScore = calculateScore(buzzerEvent.elapsedSeconds);

    // Calculate negative points based on percentage setting
    const negativePercentage = session.settings.negativePointsPercentage || 25;
    const negativePoints = -Math.round((potentialScore * negativePercentage) / 100);

    buzzerEvent.score = negativePoints;
    buzzerEvent.isCorrect = false;

    // Update participant total score (deduct points)
    session.scores[participantId] = (session.scores[participantId] || 0) + negativePoints;

    return negativePoints;
  }

  /**
   * End the current round
   */
  endRound(sessionId: string, roundId: string): void {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return;
    }

    const round = session.rounds.find(r => r.id === roundId);
    if (round) {
      round.isComplete = true;
    }
  }

  /**
   * Pause the game
   */
  pauseGame(sessionId: string): void {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (session) {
      session.status = 'paused';
    }
  }

  /**
   * Resume the game
   */
  resumeGame(sessionId: string): void {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (session) {
      session.status = 'playing';
    }
  }

  /**
   * End the game
   */
  endGame(sessionId: string): void {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date().toISOString();
    }
  }

  /**
   * Delete a session and all its participants
   */
  deleteSession(sessionId: string): void {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (session) {
      // Remove all participants
      session.participantIds.forEach(participantId => {
        this.participants.delete(participantId);
      });

      this.sessions.delete(normalizedId);
    }
  }

  /**
   * Get final scores for a session
   */
  getFinalScores(sessionId: string): Array<{ participantId: string; participantName: string; score: number }> {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return [];
    }

    return session.participantIds
      .map(participantId => {
        const participant = this.participants.get(participantId);
        return {
          participantId,
          participantName: participant?.name || 'Unknown',
          score: session.scores[participantId] || 0,
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  /**
   * Get current round for a session
   */
  getCurrentRound(sessionId: string): GameRound | undefined {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session || session.currentRoundIndex < 0) {
      return undefined;
    }
    return session.rounds[session.currentRoundIndex];
  }

  /**
   * Restart game with same session ID and participants
   */
  restartGame(sessionId: string, songs: Song[]): GameSession | null {
    const normalizedId = this.normalizeSessionId(sessionId);
    const session = this.sessions.get(normalizedId);
    if (!session) {
      return null;
    }

    // Keep participants but reset their scores
    const resetScores: { [participantId: string]: number } = {};
    session.participantIds.forEach(participantId => {
      resetScores[participantId] = 0;
    });

    // Reset game state while keeping session ID and participants
    session.status = 'waiting';
    session.songs = songs;
    session.currentRoundIndex = -1;
    session.rounds = [];
    session.scores = resetScores;
    session.createdAt = new Date().toISOString();
    delete session.endedAt;

    return session;
  }
}

// Singleton instance
export const gameSessionService = new GameSessionService();
