import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@song-quiz/shared';
import { SERVER_EVENTS } from '@song-quiz/shared';
import { useParticipantStore } from '../store/participantStore';
import { playCorrectGuessSound, playIncorrectGuessSound, playRoundStartCueSound } from '../utils/soundEffects';

const BACKEND_URL = window.location.origin;

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isInitialized = false;
  private lastRoundId: string | null = null;

  initialize() {
    if (this.isInitialized) {
      console.log('✅ Socket already initialized');
      return;
    }

    console.log('🔌 Initializing socket connection to:', BACKEND_URL);

    this.socket = io(BACKEND_URL, {
      // Default: start with polling, upgrade to WebSocket
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      const store = useParticipantStore.getState();
      store.setConnected(true);
      store.setError(null);

      // Re-join game after reconnect (new socket = lost server-side association)
      const { sessionId, participantId } = store;
      if (sessionId && participantId && this.socket) {
        console.log(`🔄 Reconnected — rejoining session ${sessionId} as ${participantId}`);
        this.socket.emit('rejoin_game', { sessionId, participantId }, (response) => {
          if (response.success) {
            console.log('✅ Rejoined game after reconnect');
          } else {
            console.error('❌ Rejoin failed:', response.error);
            store.setError('Lost connection to game. Please rejoin.');
          }
        });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      const store = useParticipantStore.getState();
      store.setConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      const store = useParticipantStore.getState();
      store.setError('Connection error. Please check your network.');
    });

    // Listen for game events
    this.socket.on(SERVER_EVENTS.GAME_STATE_UPDATE, ({ session }) => {
      console.log('📡 GAME_STATE_UPDATE received!');
      console.log('  - Session ID:', session.id);
      console.log('  - Status:', session.status);
      console.log('  - Current round:', session.currentRoundIndex);
      console.log('  - Participants:', session.participantIds?.length || 0);

      const store = useParticipantStore.getState();
      const currentStatus = store.gameSession?.status;

      console.log('  - Previous status:', currentStatus);
      console.log('  - Status changed:', currentStatus !== session.status);

      store.setGameSession(session);

      // Defensive round transition reset: avoids stale selected answer carrying over
      const activeRound = session.rounds?.[session.currentRoundIndex];
      const activeRoundId = activeRound?.id || null;
      if (activeRoundId && activeRoundId !== this.lastRoundId) {
        store.setBuzzed(false);
        store.setHasAnswered(false);
        store.setSelectedAnswer(null);
        store.clearReactions();
      }
      this.lastRoundId = activeRoundId;

      // Extract multiple choice options for current round
      if (session.settings.gameMode === 'multiple_choice') {
        const currentRound = session.rounds?.[session.currentRoundIndex];
        if (currentRound?.multipleChoiceOptions) {
          store.setMultipleChoiceOptions(currentRound.multipleChoiceOptions);
        }
      }

      // Update my score if available
      const participantId = store.participantId;
      if (participantId && session.scores?.[participantId] !== undefined) {
        store.setMyScore(session.scores[participantId]);
      }
    });

    this.socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, ({ participant }) => {
      console.log('👋 Participant joined:', participant.name);
    });

    this.socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, ({ participantId }) => {
      console.log('👋 Participant left:', participantId);
    });

    this.socket.on(SERVER_EVENTS.BUZZER_EVENT, ({ buzzerEvent, position }) => {
      console.log('🔔 Buzzer event:', buzzerEvent.participantName, 'at position', position);
      const store = useParticipantStore.getState();
      if (buzzerEvent.participantId !== store.participantId) {
        console.log(`${buzzerEvent.participantName} buzzed at position ${position}`);
      }
    });

    this.socket.on(SERVER_EVENTS.SONG_STARTED, ({ roundId }) => {
      console.log('🎵 Song started:', roundId);
      const store = useParticipantStore.getState();
      store.setBuzzed(false);
      store.setHasAnswered(false);
      store.setSelectedAnswer(null);
      store.clearReactions();
      playRoundStartCueSound();
    });

    this.socket.on(SERVER_EVENTS.ROUND_ENDED, ({ roundId, winnerName, correctAnswer }) => {
      console.log('🏁 Round ended:', roundId);
      console.log('Winner:', winnerName || 'No one');
      console.log('Correct answer:', `${correctAnswer.title} - ${correctAnswer.artist}`);
      const store = useParticipantStore.getState();
      store.setBuzzed(false);
      store.setHasAnswered(false);
      store.setSelectedAnswer(null);
    });

    this.socket.on(SERVER_EVENTS.SCORE_UPDATE, ({ scores }) => {
      console.log('📊 Score update:', scores);
      const store = useParticipantStore.getState();
      const participantId = store.participantId;
      if (participantId && scores[participantId] !== undefined) {
        store.setMyScore(scores[participantId]);
      }
    });

    this.socket.on(SERVER_EVENTS.GAME_ENDED, ({ finalScores, winnerId }) => {
      console.log('🎉 Game ended! Winner:', winnerId);
      console.log('Final scores:', finalScores);
    });

    this.socket.on(SERVER_EVENTS.REACTION_EVENT, (reaction) => {
      const store = useParticipantStore.getState();
      store.addReaction(reaction);
    });

    this.socket.on(SERVER_EVENTS.ERROR, ({ message }) => {
      console.error('❌ Server error:', message);
      const store = useParticipantStore.getState();
      store.setError(message);
    });

    this.isInitialized = true;
  }

  async joinGame(sessionId: string, participantName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not initialized' });
        return;
      }

      console.log('🎮 Joining game:', sessionId, 'as', participantName);

      this.socket.emit('join_game', { sessionId, participantName }, (response) => {
        if (response.success && response.participant) {
          console.log('✅ Successfully joined game:', response.participant.id);
          const store = useParticipantStore.getState();
          store.setParticipantId(response.participant.id);
          resolve({ success: true });
        } else {
          console.error('❌ Failed to join game:', response.error);
          const store = useParticipantStore.getState();
          store.setError(response.error || 'Failed to join game');
          resolve({ success: false, error: response.error });
        }
      });
    });
  }

  async buzzIn(sessionId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not initialized' });
        return;
      }

      console.log('🔔 Buzzing in...');

      this.socket.emit('buzzer_pressed', { sessionId }, (response) => {
        if (response.success) {
          console.log('✅ Buzz successful!');
          const store = useParticipantStore.getState();
          store.setBuzzed(true);
          resolve({ success: true });
        } else {
          console.error('❌ Buzz failed:', response.error);
          resolve({ success: false, error: response.error });
        }
      });
    });
  }

  async submitMultipleChoiceAnswer(
    sessionId: string,
    selectedAnswer: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not initialized' });
        return;
      }

      console.log('📝 Submitting answer:', selectedAnswer);

      this.socket.emit('multiple_choice_answer', { sessionId, selectedAnswer }, (response) => {
        if (response.success) {
          console.log('✅ Answer submitted!');
          const store = useParticipantStore.getState();
          store.setHasAnswered(true);
          if (response.result?.isCorrect) {
            playCorrectGuessSound();
          } else {
            playIncorrectGuessSound();
          }
          resolve({ success: true });
        } else {
          console.error('❌ Answer failed:', response.error);
          resolve({ success: false, error: response.error });
        }
      });
    });
  }

  async sendReaction(emoji: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not initialized' });
        return;
      }

      this.socket.emit('send_reaction', { emoji }, (response) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  }

  leaveGame(sessionId: string) {
    if (!this.socket) return;

    console.log('👋 Leaving game:', sessionId);
    this.socket.emit('leave_game', { sessionId });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
      this.lastRoundId = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
