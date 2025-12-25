import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, GameSession } from '@song-quiz/shared';
import { SERVER_EVENTS } from '@song-quiz/shared';
import config from '../config/environment';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private sessionId: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log('🔌 Connecting to socket server:', config.backendUrl);

    this.socket = io(config.backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);

      // Rejoin session if we were in one
      if (this.sessionId) {
        console.log('🔄 Auto-rejoining session:', this.sessionId);
        this.joinSession(this.sessionId);
      } else {
        console.log('ℹ️  No session to rejoin');
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on(SERVER_EVENTS.GAME_STATE_UPDATE, ({ session }) => {
      console.log('📡 Game state update:', session.status);
      this.emit('game_state_update', session);
    });

    this.socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, ({ participant }) => {
      console.log('👋 Participant joined:', participant.name);
      this.emit('participant_joined', participant);
    });

    this.socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, ({ participantId }) => {
      console.log('👋 Participant left:', participantId);
      this.emit('participant_left', participantId);
    });

    this.socket.on(SERVER_EVENTS.BUZZER_EVENT, ({ buzzerEvent, position }) => {
      console.log('🔔 Buzzer event:', buzzerEvent.participantName, 'at position', position);
      this.emit('buzzer_event', { buzzerEvent, position });
    });

    this.socket.on(SERVER_EVENTS.ERROR, ({ message }) => {
      console.error('❌ Server error:', message);
      this.emit('error', message);
    });
  }

  joinSession(sessionId: string) {
    this.sessionId = sessionId;

    if (!this.socket) {
      console.log('⚠️ Socket not initialized, connecting first...');
      this.connect();
      // Connection handler will call joinSession when connected
      return;
    }

    if (!this.socket.connected) {
      console.log('⚠️ Socket not connected yet, will join when connection establishes');
      return;
    }

    // Quiz master doesn't use join_game event, just joins the room to listen
    // The session is already created, we just want to listen to events
    console.log('📱 Emitting join_session_as_master for session:', sessionId);
    this.socket.emit('join_session_as_master', { sessionId });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.sessionId = null;
      this.listeners.clear();
    }
  }

  // Event emitter pattern for React components
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
