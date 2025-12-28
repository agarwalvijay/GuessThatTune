import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { gameSessionService } from '../services/GameSessionService';
import { qrCodeGenerator } from '../utils/qrCodeGenerator';
import {
  CreateGameSessionRequest,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SERVER_EVENTS,
} from '@song-quiz/shared';

const router = Router();
let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setSocketIO(socketIO: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  io = socketIO;
}

/**
 * POST /api/game/create
 * Create a new game session
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const createRequest: CreateGameSessionRequest = req.body;
    const { spotifyAccessToken, spotifyPlaylistId } = req.body;

    if (!createRequest.songs || createRequest.songs.length === 0) {
      return res.status(400).json({ error: 'Songs are required' });
    }

    const session = gameSessionService.createSession(createRequest);
    console.log('📱 Game session created:', session.id);

    // Store Spotify credentials with the session
    if (spotifyAccessToken) {
      session.spotifyAccessToken = spotifyAccessToken;
    }
    if (spotifyPlaylistId) {
      session.spotifyPlaylistId = spotifyPlaylistId;
    }

    // Generate QR code
    const baseUrl = process.env.WEB_APP_URL || 'http://localhost:5173';
    const joinUrl = qrCodeGenerator.generateJoinUrl(baseUrl, session.id);
    const qrCodeDataUrl = await qrCodeGenerator.generateQRCode(joinUrl);

    console.log('🔗 Join URL:', joinUrl);
    console.log('👥 Participants:', session.participantIds.length);

    return res.json({
      session,
      joinUrl,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error('Error creating game session:', error);
    return res.status(500).json({ error: 'Failed to create game session' });
  }
});

/**
 * GET /api/game/:sessionId
 * Get game session details
 */
router.get('/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = gameSessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({ session });
});

/**
 * POST /api/game/:sessionId/start
 * Start the game
 */
router.post('/:sessionId/start', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const round = gameSessionService.startGame(sessionId);

  if (!round) {
    return res.status(400).json({ error: 'Failed to start game' });
  }

  const session = gameSessionService.getSession(sessionId);

  // Broadcast game state update to all participants
  if (io && session) {
    console.log('🎮 Broadcasting game start to session:', sessionId);
    io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
    io.to(sessionId).emit(SERVER_EVENTS.SONG_STARTED, {
      roundId: round.id,
      songStartTime: round.songStartTime || Date.now(),
      duration: session.settings.songDuration,
    });
  }

  return res.json({
    success: true,
    round,
    session,
  });
});

/**
 * POST /api/game/:sessionId/next
 * Start next round
 */
router.post('/:sessionId/next', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // End current round first
  const currentRound = gameSessionService.getCurrentRound(sessionId);
  if (currentRound) {
    gameSessionService.endRound(sessionId, currentRound.id);
  }

  // Start next round
  const nextRound = gameSessionService.startNextRound(sessionId);

  if (!nextRound) {
    // Game is complete
    const session = gameSessionService.getSession(sessionId);

    // Broadcast game ended
    if (io && session) {
      const finalScores = Object.entries(session.scores).map(([participantId, score]) => ({
        participantId,
        participantName: participantId, // TODO: Get actual name
        score,
      }));
      const winnerId = finalScores.reduce((prev, current) =>
        (current.score > prev.score) ? current : prev
      ).participantId;

      io.to(sessionId).emit(SERVER_EVENTS.GAME_ENDED, { finalScores, winnerId });
      io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
    }

    return res.json({
      success: true,
      gameComplete: true,
      session,
    });
  }

  const session = gameSessionService.getSession(sessionId);

  // Broadcast new round started
  if (io && session) {
    io.to(sessionId).emit(SERVER_EVENTS.SONG_STARTED, {
      roundId: nextRound.id,
      songStartTime: nextRound.songStartTime || Date.now(),
      duration: session.settings.songDuration,
    });
    io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
  }

  return res.json({
    success: true,
    round: nextRound,
    session,
  });
});

/**
 * POST /api/game/:sessionId/score
 * Mark an answer as correct and award points
 */
router.post('/:sessionId/score', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { roundId, participantId } = req.body;

  if (!roundId || !participantId) {
    return res.status(400).json({ error: 'roundId and participantId are required' });
  }

  const score = gameSessionService.markAnswerCorrect(sessionId, roundId, participantId);
  const session = gameSessionService.getSession(sessionId);
  const round = session?.rounds.find(r => r.id === roundId);

  // Broadcast score update and round ended to all participants
  if (io && session) {
    io.to(sessionId).emit(SERVER_EVENTS.SCORE_UPDATE, { scores: session.scores });

    if (round) {
      const song = session.songs.find(s => s.id === round.songId);
      io.to(sessionId).emit(SERVER_EVENTS.ROUND_ENDED, {
        roundId,
        winnerId: participantId,
        winnerName: session.scores[participantId] !== undefined ? participantId : undefined,
        correctAnswer: {
          title: song?.answer.title || 'Unknown',
          artist: song?.answer.artist || 'Unknown',
        },
      });
    }

    io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
  }

  return res.json({
    success: true,
    score,
    scores: session?.scores,
  });
});

/**
 * POST /api/game/:sessionId/pause
 * Pause the game
 */
router.post('/:sessionId/pause', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  gameSessionService.pauseGame(sessionId);
  const session = gameSessionService.getSession(sessionId);

  return res.json({ success: true, session });
});

/**
 * POST /api/game/:sessionId/resume
 * Resume the game
 */
router.post('/:sessionId/resume', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  gameSessionService.resumeGame(sessionId);
  const session = gameSessionService.getSession(sessionId);

  return res.json({ success: true, session });
});

/**
 * POST /api/game/:sessionId/end
 * End the game and notify all participants
 */
router.post('/:sessionId/end', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const finalScores = gameSessionService.getFinalScores(sessionId);
  gameSessionService.endGame(sessionId);
  const session = gameSessionService.getSession(sessionId);

  // Broadcast game ended to all participants
  if (io && session) {
    console.log('🏁 Broadcasting game end to session:', sessionId);
    console.log('  - New status:', session.status);
    console.log('  - Participants:', session.participantIds.length);

    // Check how many sockets are in the room
    const room = io.sockets.adapter.rooms.get(sessionId);
    const socketsInRoom = room ? room.size : 0;
    console.log('  - Sockets in room:', socketsInRoom);

    io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
    io.to(sessionId).emit(SERVER_EVENTS.GAME_ENDED, {
      finalScores: finalScores.map(fs => ({
        participantId: fs.participantId,
        participantName: fs.participantName,
        score: fs.score,
      })),
      winnerId: finalScores.length > 0 ? finalScores[0].participantId : undefined,
    });
  }

  return res.json({
    success: true,
    finalScores,
    session,
  });
});

/**
 * POST /api/game/:sessionId/restart
 * Restart game with same session ID and participants
 */
router.post('/:sessionId/restart', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { songs } = req.body;

  if (!songs || songs.length === 0) {
    return res.status(400).json({ error: 'Songs are required' });
  }

  const session = gameSessionService.restartGame(sessionId, songs);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Broadcast game restart to all participants
  if (io) {
    console.log('🔄 Broadcasting game restart to session:', sessionId);
    console.log('  - New status:', session.status);
    console.log('  - Participants:', session.participantIds.length);

    // Check how many sockets are in the room
    const room = io.sockets.adapter.rooms.get(sessionId);
    const socketsInRoom = room ? room.size : 0;
    console.log('  - Sockets in room:', socketsInRoom);

    io.to(sessionId).emit(SERVER_EVENTS.GAME_STATE_UPDATE, { session });
  }

  return res.json({
    success: true,
    session,
  });
});

/**
 * DELETE /api/game/:sessionId
 * End and delete a game session
 */
router.delete('/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const finalScores = gameSessionService.getFinalScores(sessionId);
  gameSessionService.endGame(sessionId);

  return res.json({
    success: true,
    finalScores,
  });
});

export default router;
