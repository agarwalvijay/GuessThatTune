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
    console.log(`${new Date().toISOString()} Client connected: ${socket.id} transport: ${socket.conn.transport.name}`);

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

        // Enhanced logging for diagnostics
        const roomSize = io.sockets.adapter.rooms.get(sessionId)?.size || 0;
        console.log(`✅ Participant ${participant.name} (${participant.id}) joined session ${sessionId}`);
        console.log(`   📢 Room ${sessionId} now has ${roomSize} connected sockets`);
        console.log(`   👥 Session has ${updatedSession?.participantIds.length || 0} total participants`);
      } catch (error) {
        console.error('Error in join_game:', error);
        callback({ success: false, error: 'Server error' });
      }
    });

    /**
     * Handle participant reconnecting to a game (re-associate existing participant with new socket)
     */
    socket.on('rejoin_game', ({ sessionId, participantId }, callback) => {
      try {
        if (!isValidSessionId(sessionId)) {
          callback({ success: false, error: 'Invalid session ID' });
          return;
        }

        const session = gameSessionService.getSession(sessionId);
        if (!session) {
          callback({ success: false, error: 'Session not found' });
          return;
        }

        const participant = gameSessionService.getParticipant(participantId);
        if (!participant) {
          callback({ success: false, error: 'Participant not found' });
          return;
        }

        // Re-associate with new socket
        participant.socketId = socket.id;
        participant.isConnected = true;

        // Store in socket data
        socket.data.participantId = participantId;
        socket.data.sessionId = sessionId;

        // Re-join socket room
        socket.join(sessionId);

        // Send current game state
        socket.emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });

        callback({ success: true, participant: { id: participant.id, name: participant.name } });

        console.log(`🔄 Participant ${participant.name} (${participantId}) rejoined session ${sessionId} with new socket ${socket.id}`);
      } catch (error) {
        console.error('Error in rejoin_game:', error);
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
     * Handle multiple choice answer submission
     */
    socket.on('multiple_choice_answer', ({ sessionId, selectedAnswer }, callback) => {
      try {
        const participantId = socket.data.participantId;

        if (!participantId) {
          callback({ success: false, error: 'Not joined to any session' });
          return;
        }

        const answer = gameSessionService.handleMultipleChoiceAnswer(
          sessionId,
          participantId,
          selectedAnswer
        );

        if (!answer) {
          callback({ success: false, error: 'Answer rejected' });
          return;
        }

        // Broadcast answer submitted
        io.to(sessionId).emit(SERVER_EVENTS.MULTIPLE_CHOICE_SUBMITTED, {
          answer,
          participantId,
        });

        // Broadcast updated game state to quiz master
        const session = gameSessionService.getSession(sessionId);
        if (session) {
          const roomSize = io.sockets.adapter.rooms.get(sessionId)?.size || 0;
          console.log(`📢 Broadcasting GAME_STATE_UPDATE to ${roomSize} sockets in room ${sessionId}`);
          io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
        }

        // If correct and first, broadcast round ended
        const currentRound = gameSessionService.getCurrentRound(sessionId);

        if (answer.isCorrect && currentRound?.winnerId === participantId && session) {
          const song = session.songs.find(s => s.id === currentRound.songId);

          io.to(sessionId).emit(SERVER_EVENTS.ROUND_ENDED, {
            roundId: currentRound.id,
            winnerId: participantId,
            winnerName: answer.participantName,
            correctAnswer: {
              title: song?.answer.title || 'Unknown',
              artist: song?.answer.artist || 'Unknown',
            },
          });

          io.to(sessionId).emit(SERVER_EVENTS.SCORE_UPDATE, {
            scores: session.scores
          });
        }

        callback({ success: true, result: answer });

        console.log(`MC answer from ${answer.participantName}: ${selectedAnswer} (${answer.isCorrect ? '✓' : '✗'})`);
      } catch (error) {
        console.error('Error in multiple_choice_answer:', error);
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
    socket.on('disconnect', (reason) => {
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

        console.log(`${new Date().toISOString()} Client disconnected: ${socket.id} reason: ${reason}`);
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });

  return io;
}
