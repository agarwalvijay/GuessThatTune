import { io, Socket } from 'socket.io-client';
import { config } from '../config/environment';
import type { GameSession } from '../store/appStore';

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  /**
   * Connect to the Socket.IO server
   */
  connect(): void {
    if (this.socket) {
      return;
    }

    this.socket = io(config.backendUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  /**
   * Disconnect from the Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Join a game session room
   */
  joinSession(sessionId: string): void {
    if (this.socket) {
      this.socket.emit('join_session_as_master', { sessionId });
      console.log(`📡 Joined session as master: ${sessionId}`);
    }
  }

  /**
   * Leave a game session room
   */
  leaveSession(sessionId: string): void {
    if (this.socket) {
      this.socket.emit('leave_session', { sessionId });
      console.log(`📡 Left session: ${sessionId}`);
    }
  }

  /**
   * Listen for participant joining
   */
  onParticipantJoined(callback: (participant: { id: string; name: string }) => void): void {
    this.on('participant_joined', callback);
  }

  /**
   * Listen for participant leaving
   */
  onParticipantLeft(callback: (participantId: string) => void): void {
    this.on('participant_left', callback);
  }

  /**
   * Listen for game session updates
   */
  onSessionUpdate(callback: (data: { session: GameSession }) => void): void {
    this.on('game_state_update', callback);
  }

  /**
   * Listen for game start (same as session update)
   */
  onGameStarted(callback: (data: { session: GameSession }) => void): void {
    this.on('game_state_update', callback);
  }

  /**
   * Listen for round/song start
   */
  onRoundStarted(callback: (data: { roundId: string; songStartTime: number; duration: number }) => void): void {
    this.on('song_started', callback);
  }

  /**
   * Listen for buzzer press
   */
  onBuzzerPressed(callback: (data: { participantId: string; participantName: string }) => void): void {
    this.on('buzzer_event', callback);
  }

  /**
   * Listen for round end
   */
  onRoundEnded(callback: (data: { roundId: string; winnerId?: string; correctAnswer: { title: string; artist: string } }) => void): void {
    this.on('round_ended', callback);
  }

  /**
   * Listen for score update
   */
  onScoreUpdate(callback: (data: { scores: Record<string, number> }) => void): void {
    this.on('score_update', callback);
  }

  /**
   * Listen for game end
   */
  onGameEnded(callback: (data: { finalScores: any[]; winnerId?: string }) => void): void {
    this.on('game_ended', callback);
  }

  /**
   * Generic event listener
   */
  on(event: string, callback: SocketEventCallback): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: SocketEventCallback): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    if (this.socket) {
      this.socket.emit(event, ...args);
    }
  }

  /**
   * Check if socket is connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
