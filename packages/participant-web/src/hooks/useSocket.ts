import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@song-quiz/shared';
import { SERVER_EVENTS } from '@song-quiz/shared';
import { useParticipantStore } from '../store/participantStore';

// Connect to the same origin (backend now serves the web app)
const BACKEND_URL = window.location.origin;

export function useSocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  const {
    setParticipantId,
    setGameSession,
    setConnected,
    setError,
    setBuzzed,
    setMyScore,
    participantId,
  } = useParticipantStore();

  // Initialize socket connection
  useEffect(() => {
    if (!socketRef.current) {
      console.log('🔌 Connecting to socket server:', BACKEND_URL);

      socketRef.current = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
        setConnected(true);
        setError(null);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Connection error. Please check your network.');
      });

      // Game events
      socket.on(SERVER_EVENTS.GAME_STATE_UPDATE, ({ session }) => {
        console.log('📡 Game state update:', session.status);
        setGameSession(session);

        // Update my score if available
        if (participantId && session.scores?.[participantId] !== undefined) {
          setMyScore(session.scores[participantId]);
        }
      });

      socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, ({ participant }) => {
        console.log('👋 Participant joined:', participant.name);
        // The game state update will handle this
      });

      socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, ({ participantId: leftParticipantId }) => {
        console.log('👋 Participant left:', leftParticipantId);
        // The game state update will handle this
      });

      socket.on(SERVER_EVENTS.BUZZER_EVENT, ({ buzzerEvent, position }) => {
        console.log('🔔 Buzzer event:', buzzerEvent.participantName, 'at position', position);
        // If it's not me who buzzed, just log it
        if (buzzerEvent.participantId !== participantId) {
          console.log(`${buzzerEvent.participantName} buzzed at position ${position}`);
        }
      });

      socket.on(SERVER_EVENTS.SONG_STARTED, ({ roundId }) => {
        console.log('🎵 Song started:', roundId);
        // Reset buzzer state for new song
        setBuzzed(false);
      });

      socket.on(SERVER_EVENTS.ROUND_ENDED, ({ roundId, winnerName, correctAnswer }) => {
        console.log('🏁 Round ended:', roundId);
        console.log('Winner:', winnerName || 'No one');
        console.log('Correct answer:', `${correctAnswer.title} - ${correctAnswer.artist}`);

        // Reset buzzer for next round
        setBuzzed(false);
      });

      socket.on(SERVER_EVENTS.SCORE_UPDATE, ({ scores }) => {
        console.log('📊 Score update:', scores);
        if (participantId && scores[participantId] !== undefined) {
          setMyScore(scores[participantId]);
        }
      });

      socket.on(SERVER_EVENTS.GAME_ENDED, ({ finalScores, winnerId }) => {
        console.log('🎉 Game ended! Winner:', winnerId);
        console.log('Final scores:', finalScores);
      });

      socket.on(SERVER_EVENTS.ERROR, ({ message }) => {
        console.error('❌ Server error:', message);
        setError(message);
      });
    }

    return () => {
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setConnected, setError, setGameSession, setBuzzed, setMyScore, participantId]);

  // Join game function
  const joinGame = useCallback(
    (sessionId: string, participantName: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ success: false, error: 'Socket not connected' });
          return;
        }

        console.log('🎮 Joining game:', sessionId, 'as', participantName);

        socketRef.current.emit('join_game', { sessionId, participantName }, (response) => {
          if (response.success && response.participant) {
            console.log('✅ Successfully joined game:', response.participant.id);
            setParticipantId(response.participant.id);
            resolve({ success: true });
          } else {
            console.error('❌ Failed to join game:', response.error);
            setError(response.error || 'Failed to join game');
            resolve({ success: false, error: response.error });
          }
        });
      });
    },
    [setParticipantId, setError]
  );

  // Buzz in function
  const buzzIn = useCallback(
    (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ success: false, error: 'Socket not connected' });
          return;
        }

        console.log('🔔 Buzzing in...');

        socketRef.current.emit('buzzer_pressed', { sessionId }, (response) => {
          if (response.success) {
            console.log('✅ Buzz successful!');
            setBuzzed(true);
            resolve({ success: true });
          } else {
            console.error('❌ Buzz failed:', response.error);
            resolve({ success: false, error: response.error });
          }
        });
      });
    },
    [setBuzzed]
  );

  // Leave game function
  const leaveGame = useCallback((sessionId: string) => {
    if (!socketRef.current) return;

    console.log('👋 Leaving game:', sessionId);
    socketRef.current.emit('leave_game', { sessionId });
  }, []);

  return {
    joinGame,
    buzzIn,
    leaveGame,
    isConnected: socketRef.current?.connected || false,
  };
}
