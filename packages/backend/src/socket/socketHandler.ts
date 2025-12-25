import { Server, Socket } from 'socket.io';
import { gameSessionService } from '../services/GameSessionService';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SERVER_EVENTS,
  sanitizeParticipantName,
  isValidParticipantName,
  isValidSessionId,
} from '@song-quiz/shared';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * Handle participant joining a game
     */
    socket.on('join_game', ({ sessionId, participantName }, callback) => {
      try {
        // Validate input
        if (!isValidSessionId(sessionId)) {
          callback({ success: false, error: 'Invalid session ID' });
          return;
        }

        if (!isValidParticipantName(participantName)) {
          callback({ success: false, error: 'Invalid participant name' });
          return;
        }

        // Check if session exists
        const session = gameSessionService.getSession(sessionId);
        if (!session) {
          callback({ success: false, error: 'Session not found' });
          return;
        }

        // Sanitize participant name
        const sanitizedName = sanitizeParticipantName(participantName);

        // Add participant to session
        const participant = gameSessionService.addParticipant(sessionId, sanitizedName, socket.id);

        if (!participant) {
          callback({ success: false, error: 'Failed to join session' });
          return;
        }

        // Store participant info in socket data
        socket.data.participantId = participant.id;
        socket.data.sessionId = sessionId;

        // Join socket.io room for this session
        socket.join(sessionId);

        // Notify all clients in the session
        io.to(sessionId).emit(SERVER_EVENTS.PARTICIPANT_JOINED, { participant });

        // Send updated game state to all participants in the session
        const updatedSession = gameSessionService.getSession(sessionId);
        if (updatedSession) {
          io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session: updatedSession });
        }

        callback({ success: true, participant });

        console.log(`Participant ${participant.name} (${participant.id}) joined session ${sessionId}`);
      } catch (error) {
        console.error('Error in join_game:', error);
        callback({ success: false, error: 'Server error' });
      }
    });

    /**
     * Handle quiz master joining to observe session
     */
    socket.on('join_session_as_master', ({ sessionId }) => {
      try {
        // Validate session
        if (!isValidSessionId(sessionId)) {
          console.error('Invalid session ID for master join');
          return;
        }

        // Check if session exists
        const session = gameSessionService.getSession(sessionId);
        if (!session) {
          console.error('Session not found for master join');
          return;
        }

        // Just join the room to receive updates
        socket.join(sessionId);
        console.log(`Quiz master joined session ${sessionId} as observer`);

        // Send current game state
        socket.emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
      } catch (error) {
        console.error('Error in join_session_as_master:', error);
      }
    });

    /**
     * Handle buzzer press
     */
    socket.on('buzzer_pressed', ({ sessionId }, callback) => {
      try {
        const participantId = socket.data.participantId;

        if (!participantId) {
          callback({ success: false, error: 'Not joined to any session' });
          return;
        }

        // Validate session
        if (!isValidSessionId(sessionId)) {
          callback({ success: false, error: 'Invalid session ID' });
          return;
        }

        // Handle buzzer press
        const buzzerEvent = gameSessionService.handleBuzzerPress(sessionId, participantId);

        if (!buzzerEvent) {
          callback({ success: false, error: 'Buzzer press rejected' });
          return;
        }

        // Get current round to find buzzer position
        const currentRound = gameSessionService.getCurrentRound(sessionId);
        const position = currentRound?.buzzerEvents.length || 0;

        // Broadcast buzzer event to all clients in session
        io.to(sessionId).emit(SERVER_EVENTS.BUZZER_EVENT, {
          buzzerEvent,
          position,
        });

        callback({ success: true, buzzerEvent });

        console.log(`Buzzer pressed by ${buzzerEvent.participantName} at ${buzzerEvent.elapsedSeconds.toFixed(2)}s`);
      } catch (error) {
        console.error('Error in buzzer_pressed:', error);
        callback({ success: false, error: 'Server error' });
      }
    });

    /**
     * Handle participant leaving
     */
    socket.on('leave_game', ({ sessionId }) => {
      try {
        const participantId = socket.data.participantId;

        if (participantId) {
          gameSessionService.removeParticipant(participantId);

          // Notify all clients in the session
          io.to(sessionId).emit(SERVER_EVENTS.PARTICIPANT_LEFT, { participantId });

          // Leave socket.io room
          socket.leave(sessionId);

          console.log(`Participant ${participantId} left session ${sessionId}`);
        }

        // Clear socket data
        socket.data.participantId = undefined;
        socket.data.sessionId = undefined;
      } catch (error) {
        console.error('Error in leave_game:', error);
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      try {
        const participantId = socket.data.participantId;
        const sessionId = socket.data.sessionId;

        if (participantId && sessionId) {
          // Mark participant as disconnected but don't remove them yet
          // They might reconnect
          const participant = gameSessionService.getParticipant(participantId);
          if (participant) {
            participant.isConnected = false;
          }

          io.to(sessionId).emit(SERVER_EVENTS.PARTICIPANT_LEFT, { participantId });

          console.log(`Participant ${participantId} disconnected from session ${sessionId}`);
        }

        console.log(`Client disconnected: ${socket.id}`);
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });

  return io;
}
